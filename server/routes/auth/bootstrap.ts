import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertUserSchema } from "@shared/schema";

export function registerAuthBootstrapRoutes(app: Express) {
  // ===== BOOTSTRAP AND DEV ROUTES =====

  // One-time admin creation route (for production bootstrap)
  app.post("/api/bootstrap-admin", async (req: any, res: any) => {
    try {
      const { email, password, firstName, lastName, bootstrapSecret } = req.body;

      // Security: Check bootstrap secret if configured in production
      if (process.env.NODE_ENV === 'production' && process.env.BOOTSTRAP_SECRET) {
        if (!bootstrapSecret || bootstrapSecret !== process.env.BOOTSTRAP_SECRET) {
          return res.status(403).json({
            message: "Invalid bootstrap secret"
          });
        }
      }

      // Use proper validation with insertUserSchema
      const adminUserSchema = insertUserSchema.extend({
        password: insertUserSchema.shape.passwordHash.optional()
      }).omit({ passwordHash: true });

      const validationResult = adminUserSchema.safeParse({
        email: email?.trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim()
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.issues
        });
      }

      // Additional password validation
      if (!password || typeof password !== 'string' || password.trim().length < 6) {
        return res.status(400).json({
          message: "Password is required and must be at least 6 characters"
        });
      }

      // Hash password securely
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(password.trim(), 10);

      // Use atomic admin creation to prevent race conditions
      const result = await storage.createAdminIfNone({
        ...validationResult.data,
        passwordHash,
        isAdmin: true,
        canSeeAdminMenu: true,
      });

      if (!result.success) {
        return res.status(400).json({
          message: result.error
        });
      }

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = result.user!;

      res.json({
        message: "Admin user created successfully",
        user: userResponse
      });
    } catch (error) {
      console.error("Error creating bootstrap admin:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  // Development password reset route (remove in production)
  app.post("/api/dev/reset-password", async (req: any, res: any) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          message: "Password reset not available in production"
        });
      }

      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          message: "Email and new password are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters"
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      // Hash new password
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

      // Update user password
      await storage.updateUser(user.id, { passwordHash });

      res.json({
        message: "Password reset successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error("Error resetting password:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}
