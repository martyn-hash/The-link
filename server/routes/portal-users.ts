import type { Express } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import sgMail from "@sendgrid/mail";
import { storage } from "../storage/index";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { clientPortalUsers, clientPeople } from "@shared/schema";

export function registerPortalUserRoutes(
  app: Express,
  isAuthenticated: any
) {
  app.get("/api/portal-user/by-person/:personId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId } = req.params;
      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        const person = await storage.getPersonById(personId);
        if (!person) {
          return res.status(404).json({ message: "Person not found" });
        }

        const clientPerson = await db.query.clientPeople.findFirst({
          where: eq(clientPeople.personId, personId),
        });

        if (!clientPerson || !person.email) {
          return res.status(400).json({ message: "Person must have email and be linked to a client" });
        }

        portalUser = await storage.createClientPortalUser({
          clientId: clientPerson.clientId,
          email: person.email,
          name: person.fullName,
          personId: personId,
        });
      }

      res.json(portalUser);
    } catch (error) {
      console.error("Error fetching portal user:", error);
      res.status(500).json({ message: "Failed to fetch portal user" });
    }
  });

  app.post("/api/portal-user/generate-magic-link", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        portalUser = await storage.createClientPortalUser({
          clientId,
          email,
          name,
          personId,
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(clientPortalUsers)
        .set({
          magicLinkToken: token,
          tokenExpiry,
        })
        .where(eq(clientPortalUsers.id, portalUser.id));

      const magicLink = `https://flow.growth.accountants/portal/verify?token=${token}`;

      res.json({ magicLink, portalUser });
    } catch (error) {
      console.error("Error generating magic link:", error);
      res.status(500).json({ message: "Failed to generate magic link" });
    }
  });

  app.post("/api/portal-user/generate-qr-code", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        portalUser = await storage.createClientPortalUser({
          clientId,
          email,
          name,
          personId,
        });
      }

      const installUrl = `https://flow.growth.accountants/portal/install`;

      const qrCodeDataUrl = await QRCode.toDataURL(installUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.json({ qrCodeDataUrl, installUrl, portalUser });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post("/api/portal-user/send-invitation", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name, clientName } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        const existingUser = await storage.getClientPortalUserByEmail(email);
        if (existingUser) {
          portalUser = await storage.updateClientPortalUser(existingUser.id, {
            personId,
            name: name || existingUser.name,
            clientId: clientId || existingUser.clientId,
          });
        } else {
          portalUser = await storage.createClientPortalUser({
            clientId,
            email,
            name,
            personId,
          });
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db
        .update(clientPortalUsers)
        .set({
          magicLinkToken: token,
          tokenExpiry,
        })
        .where(eq(clientPortalUsers.id, portalUser.id));

      const magicLink = `https://flow.growth.accountants/portal/verify?token=${token}`;

      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ message: "SendGrid is not configured" });
      }

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const logoUrl = `https://flow.growth.accountants/attached_assets/full_logo_transparent_600_1761924125378.png`;

      const msg = {
        to: email,
        from: `The Link <${process.env.FROM_EMAIL || "link@growth-accountants.com"}>`,
        subject: `Welcome to ${clientName || "Client"} Portal`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 200px; height: auto; margin-bottom: 20px;" />
                <h1 style="color: white; margin: 0; font-size: 28px;">The Link</h1>
              </div>

              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name || "there"},</p>

                <p style="font-size: 16px; margin-bottom: 20px;">
                  You've been invited to access your secure client portal${clientName ? ` for ${clientName}` : ""}.
                  Click the button below to log in instantly - no password required!
                </p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${magicLink}"
                     style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Access Portal
                  </a>
                </div>

                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  This link is valid for 24 hours. If you didn't request this invitation, you can safely ignore this email.
                </p>

                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                  Or copy and paste this URL into your browser:<br>
                  <a href="${magicLink}" style="color: #0A7BBF; word-break: break-all;">${magicLink}</a>
                </p>
              </div>

              <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
                <p style="margin: 0 0 10px 0;">
                  <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
                </p>
                <p style="margin: 0; font-size: 13px;">
                  Your workflow management partner
                </p>
              </div>

              <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `,
      };

      await sgMail.send(msg);

      res.json({
        message: "Invitation sent successfully",
        magicLink,
        portalUser,
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  app.get("/api/portal-status", isAuthenticated, async (req: any, res: any) => {
    try {
      const portalUsers = await db
        .select({
          id: clientPortalUsers.id,
          clientId: clientPortalUsers.clientId,
          personId: clientPortalUsers.personId,
          lastLogin: clientPortalUsers.lastLogin,
          pushNotificationsEnabled: clientPortalUsers.pushNotificationsEnabled,
        })
        .from(clientPortalUsers);

      const statusByClient: Record<string, { hasApp: number; pushEnabled: number }> = {};

      for (const user of portalUsers) {
        if (!statusByClient[user.clientId]) {
          statusByClient[user.clientId] = { hasApp: 0, pushEnabled: 0 };
        }

        if (user.lastLogin) {
          statusByClient[user.clientId].hasApp += 1;
        }

        if (user.pushNotificationsEnabled) {
          statusByClient[user.clientId].pushEnabled += 1;
        }
      }

      res.json(statusByClient);
    } catch (error) {
      console.error("Error fetching portal status:", error);
      res.status(500).json({ message: "Failed to fetch portal status" });
    }
  });
}
