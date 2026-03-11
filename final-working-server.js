const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Use PrismaClient with adapter for localhost:5435
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

app.get('/customers/phone/:phone', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { phone: req.params.phone }
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/customers', async (req, res) => {
  try {
    const customer = await prisma.customer.create({
      data: req.body
    });
    res.json(customer);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Final working server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL}`);
});
