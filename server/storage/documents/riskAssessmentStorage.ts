import { db } from "../../db";
import { 
  riskAssessments,
  riskAssessmentResponses,
  type RiskAssessment,
  type InsertRiskAssessment,
  type RiskAssessmentResponse,
  type InsertRiskAssessmentResponse
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class RiskAssessmentStorage {
  // Risk Assessment operations
  async createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment> {
    const [newAssessment] = await db
      .insert(riskAssessments)
      .values(assessment)
      .returning();
    return newAssessment;
  }

  async getRiskAssessmentById(id: string): Promise<RiskAssessment | undefined> {
    const result = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.id, id))
      .limit(1);
    return result[0];
  }

  async getRiskAssessmentsByClientId(clientId: string): Promise<RiskAssessment[]> {
    const results = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.clientId, clientId))
      .orderBy(desc(riskAssessments.createdAt));
    return results;
  }

  async updateRiskAssessment(id: string, assessment: Partial<InsertRiskAssessment>): Promise<RiskAssessment> {
    const [updatedAssessment] = await db
      .update(riskAssessments)
      .set({ ...assessment, updatedAt: new Date() })
      .where(eq(riskAssessments.id, id))
      .returning();
    return updatedAssessment;
  }

  async deleteRiskAssessment(id: string): Promise<void> {
    await db.delete(riskAssessments).where(eq(riskAssessments.id, id));
  }

  // Risk Assessment Response operations
  async saveRiskAssessmentResponses(assessmentId: string, responses: InsertRiskAssessmentResponse[]): Promise<void> {
    // Delete existing responses for this assessment
    await db.delete(riskAssessmentResponses).where(eq(riskAssessmentResponses.riskAssessmentId, assessmentId));
    
    // Insert new responses
    if (responses.length > 0) {
      await db.insert(riskAssessmentResponses).values(responses);
    }
  }

  async getRiskAssessmentResponses(assessmentId: string): Promise<RiskAssessmentResponse[]> {
    const results = await db
      .select()
      .from(riskAssessmentResponses)
      .where(eq(riskAssessmentResponses.riskAssessmentId, assessmentId));
    return results;
  }
}
