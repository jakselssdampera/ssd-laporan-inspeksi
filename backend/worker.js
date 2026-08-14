const { Worker } = require('bullmq');
const Redis = require('ioredis');
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};
const connection = new Redis(redisOptions);

// Function to safely clean strings for filename
const clean = (str) => str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

const worker = new Worker('pdf-generation', async (job) => {
  const { reportId, workshop } = job.data;
  
  console.log(`[Job ${job.id}] Started PDF generation for reportId: ${reportId}`);

  // Fetch report data from PostgreSQL via Prisma
  const report = await prisma.report.findUnique({
    where: { id: reportId }
  });

  if (!report) {
    throw new Error(`Report not found: ${reportId}`);
  }

  // Ensure JSON fields are parsed correctly if they come as objects
  const customer = typeof report.customer === 'string' ? JSON.parse(report.customer) : (report.customer || {});
  
  const customerName = customer.customerName || 'Customer';
  const licensePlate = customer.vehiclePlate || 'NoPol';
  const inspectionDate = customer.inspectionDate || new Date().toISOString().split('T')[0];
  
  const fileName = `Inspeksi_${clean(customerName)}_${clean(licensePlate)}_${clean(inspectionDate)}.pdf`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    // In Docker, the backend container connects to the frontend via service name 'frontend' or via reverse proxy.
    // However, NGINX is exposed on port 80. Inside docker network, 'frontend' resolves to NGINX.
    // If not in docker, we use localhost.
    const renderUrl = process.env.FRONTEND_URL || 'http://frontend/render.html';
    
    await page.goto(renderUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Inject data and render HTML via client-side JS
    await page.evaluate(async (reportData, workshopData) => {
      await window.renderBackendPDF(reportData, workshopData);
    }, report, workshop);

    // Emulate screen media to ensure CSS applies correctly
    await page.emulateMediaType('screen');

    // Generate PDF to memory Buffer (not file)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      }
    });

    console.log(`[Job ${job.id}] PDF successfully generated in memory`);

    // Insert PDF into PostgreSQL as BYTEA
    const fileRecord = await prisma.inspectionFile.create({
      data: {
        reportId: report.id,
        fileName: fileName,
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        fileData: pdfBuffer
      }
    });

    // Optionally update the report record to point to this new PDF
    await prisma.report.update({
      where: { id: report.id },
      data: { pdfPath: `/api/files/${fileRecord.id}` }
    });

    console.log(`[Job ${job.id}] PDF successfully saved to database with File ID: ${fileRecord.id}`);

    // Return fileId so the backend can respond with the URL
    return { fileId: fileRecord.id };
  } catch (error) {
    console.error(`[Job ${job.id}] Failed:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

}, { 
  connection,
  concurrency: 2
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

// Connect Prisma and start
(async () => {
  await prisma.$connect();
  console.log('PDF Worker connected to PostgreSQL and is listening for jobs...');
})();

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down worker gracefully...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
