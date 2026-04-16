import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { OCRService } from "../services/ocr.service.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

function safeUnlink(filePath?: string) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

router.post('/parse-invoice', upload.single('invoice'), async (req, res) => {
  try {
    console.log('OCR CONTENT-TYPE:', req.headers['content-type']);
    console.log('OCR FILE:', req.file);
    console.log('OCR BODY:', req.body);

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);
    safeUnlink(req.file.path);

    return res.json(items);
  } catch (error: any) {
    safeUnlink(req.file?.path);
    console.error('OCR PARSE INVOICE ERROR:', error);
    return res.status(500).json({
      error: error?.message || 'Ошибка OCR при обработке накладной',
    });
  }
});

router.post("/invoice", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не загружен" });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);
    safeUnlink(req.file.path);

    return res.json({ items });
  } catch (error: any) {
    safeUnlink(req.file?.path);
    console.error("OCR INVOICE ERROR:", error);
    return res.status(500).json({
      error: error?.message || "Ошибка OCR",
    });
  }
});

export default router;