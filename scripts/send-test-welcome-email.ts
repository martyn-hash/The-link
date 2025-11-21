import { sendWelcomeEmail } from "../server/emailService";

async function sendTestEmail() {
  console.log("Sending test welcome email to martyn@growth.accountants...");
  
  try {
    const success = await sendWelcomeEmail(
      "martyn@growth.accountants",
      "Martyn",
      "https://flow.growth.accountants"
    );
    
    if (success) {
      console.log("✅ Test welcome email sent successfully!");
      console.log("📧 Email sent to: martyn@growth.accountants");
      console.log("🔗 Login URL: https://flow.growth.accountants");
    } else {
      console.error("❌ Failed to send test welcome email");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error sending test welcome email:", error);
    process.exit(1);
  }
}

sendTestEmail();
