import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function createChamaNotification(
  chamaId: string,
  data: {
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "alert";
    userId?: string;
    link?: string;
  }
) {
  try {
    await addDoc(collection(db, "chamas", chamaId, "notifications"), {
      ...data,
      readBy: [],
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
