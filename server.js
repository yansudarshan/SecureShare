import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./db.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import downloadRoutes from "./routes/downloadRoutes.js";
import shareRoutes from "./routes/shareRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", uploadRoutes);
app.use("/", fileRoutes);
app.use("/", downloadRoutes);
app.use("/", shareRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );
};

startServer();