import { storage } from "./storage";
import type { InsertTaskType } from "@shared/schema";

export async function seedTaskTypes() {
  try {
    const existingTaskTypes = await storage.getAllTaskTypes(true);
    
    if (existingTaskTypes.length > 0) {
      console.log(`[Seed] Task types already seeded (${existingTaskTypes.length} types found)`);
      return;
    }

    const defaultTaskTypes: InsertTaskType[] = [
      {
        name: "Call Client",
        description: "Make a phone call to a client",
        isActive: true,
      },
      {
        name: "Call HMRC",
        description: "Make a phone call to HMRC",
        isActive: true,
      },
      {
        name: "Tax Query",
        description: "Handle a tax-related query or issue",
        isActive: true,
      },
      {
        name: "VAT Query",
        description: "Handle a VAT-related query or issue",
        isActive: true,
      },
      {
        name: "Accounts Query",
        description: "Handle an accounts-related query or issue",
        isActive: true,
      },
      {
        name: "Complaint",
        description: "Handle a client complaint",
        isActive: true,
      },
      {
        name: "Payroll Query",
        description: "Handle a payroll-related query or issue",
        isActive: true,
      },
    ];

    console.log(`[Seed] Seeding ${defaultTaskTypes.length} default task types...`);
    
    for (const taskType of defaultTaskTypes) {
      await storage.createTaskType(taskType);
    }

    console.log(`[Seed] Successfully seeded ${defaultTaskTypes.length} task types`);
  } catch (error) {
    console.error("[Seed] Error seeding task types:", error);
  }
}
