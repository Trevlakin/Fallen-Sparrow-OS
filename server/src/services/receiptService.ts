import { uploadReceiptImage } from "../integrations/storage.js";

export async function storeExpenseReceipt(params: {
  studioId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ receiptUrl: string; storage: "r2" | "local" }> {
  return uploadReceiptImage(params);
}
