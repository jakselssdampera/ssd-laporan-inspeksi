const Fastify = require('fastify');
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');

const app = Fastify({ logger: true, bodyLimit: 52428800 }); // 50MB limit
const prisma = new PrismaClient();

// Setup CORS
app.register(cors, { origin: true });

// Setup Multipart for file uploads
app.register(multipart, {
  limits: {
    fileSize: 10485760, // 10MB limit per file before compression
  }
});

// Setup Redis & BullMQ
const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};
const connection = new Redis(redisOptions);
const pdfQueue = new Queue('pdf-generation', { connection });

// ═══════════════════════════════════════════════════════════════════════
//  REPORT CRUD ROUTES (Prisma / PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/reports/current', async (request, reply) => {
  try {
    let report = await prisma.report.findFirst({
      where: { isCurrent: true }
    });

    if (!report) {
      report = await prisma.report.create({
        data: { isCurrent: true }
      });
    }

    return reply.send(report);
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to load current report' });
  }
});

app.post('/api/reports', async (request, reply) => {
  try {
    await prisma.report.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false }
    });

    const newReport = await prisma.report.create({
      data: { isCurrent: true }
    });

    return reply.status(201).send(newReport);
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to create new report' });
  }
});

app.patch('/api/reports/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const updates = request.body;

    // Remove immutable fields just in case
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const report = await prisma.report.update({
      where: { id },
      data: updates
    });

    return reply.send(report);
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to update report' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  PHOTO UPLOAD ROUTE (Auto-Compress & Store to DB)
// ═══════════════════════════════════════════════════════════════════════

app.post('/api/upload', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    // Auto-compress with Sharp
    // Resize max 1280px on longest side, convert to WebP 80% quality
    const processedBuffer = await sharp(buffer)
      .resize(1280, 1280, {
        fit: sharp.fit.inside,
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = data.filename.split('.')[0] + '.webp';
    const mimeType = 'image/webp';
    const fileSize = processedBuffer.length;

    // We can extract reportId from fields if provided, but it's optional for just saving a file
    // Ideally the frontend sends `reportId` in the form data
    const reportId = data.fields?.reportId?.value || null;

    const fileRecord = await prisma.inspectionFile.create({
      data: {
        fileName,
        mimeType,
        fileSize,
        fileData: processedBuffer,
        reportId: reportId
      }
    });

    return reply.send({ url: `/api/files/${fileRecord.id}` });
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to upload and process image' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  FILE RETRIEVAL ROUTE (Streaming BLOB from DB)
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/files/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const fileRecord = await prisma.inspectionFile.findUnique({
      where: { id },
      select: { mimeType: true, fileData: true }
    });

    if (!fileRecord) {
      return reply.status(404).send({ error: 'File not found' });
    }

    reply.header('Content-Type', fileRecord.mimeType);
    reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return reply.send(fileRecord.fileData);
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to retrieve file' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  PDF GENERATION ROUTES
// ═══════════════════════════════════════════════════════════════════════

app.post('/api/pdf/generate', async (request, reply) => {
  try {
    const { reportId, workshop } = request.body;

    if (!reportId) {
      return reply.status(400).send({ error: 'reportId is required' });
    }

    const job = await pdfQueue.add('generate', { reportId, workshop }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: 100,
    });

    return reply.status(202).send({
      status: 'queued',
      jobId: job.id
    });
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

app.get('/api/pdf/status/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const job = await pdfQueue.getJob(id);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const state = await job.getState();
    
    if (state === 'completed') {
      const fileId = job.returnvalue?.fileId;
      await job.remove().catch(() => {});
      return reply.send({ status: 'completed', url: `/api/files/${fileId}` });
    } else if (state === 'failed') {
      return reply.status(500).send({ status: 'failed', error: job.failedReason });
    }

    return reply.send({ status: state });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to check status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════════════

const start = async () => {
  try {
    await prisma.$connect();
    app.log.info('Connected to PostgreSQL Database');
    
    const port = parseInt(process.env.PORT || '3001');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Backend Server running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
