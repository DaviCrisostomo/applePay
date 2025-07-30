import dotenv from "dotenv";
import cors from 'cors';
import path from 'path';
import { PayrocClient } from "./payroc_api_calls.js";
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const payrocClient = new PayrocClient();

app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'payment=(self)');
  next();
});

app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

app.get('/.well-known/apple-developer-merchant-id-domain-association', (req, res) => {
  const filePath = path.join(__dirname, '.well-known', 'apple-developer-merchant-id-domain-association');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    res.send(data);
  } catch (err) {
    console.error("Error reading file", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/apple', (req, res) => res.sendFile(__dirname + '/apple_pay.html'));

app.post('/validate-merchant', async (req, res) => {
  const session = await payrocClient.getAppleSession();
  
  try {
    // The session is a JSON string inside session.applePaySessionResponse
    const parsedSession = JSON.parse(session.applePaySessionResponse);
    console.log(parsedSession);
    res.json(parsedSession); // this goes directly to session.completeMerchantValidation(...)
  } catch (err) {
    console.error("Error during merchant validation:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/process-payment', async (req, res) => {
  try {
    const token = req.body.token;
    const result = await payrocClient.createPayment(
      1000, // amount in cents
      "Apple Pay Payment",
      JSON.stringify(token)
    );

    res.json(result);
  } catch (err) {
    console.error("Payment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 8080, () => console.log("Server started"));