import { ChevronDown, ChevronUp, Equal } from "lucide-react";
import type { User } from "@shared/schema";

export function formatStageName(stageName: string): string {
  return stageName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRoleName(roleName: string | null): string {
  if (!roleName) return "System";
  return roleName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatChangeReason(reason: string): string {
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatComparisonType(
  comparisonType: "equal_to" | "less_than" | "greater_than"
): string {
  switch (comparisonType) {
    case "equal_to":
      return "equal to";
    case "less_than":
      return "less than";
    case "greater_than":
      return "greater than";
    default:
      return comparisonType;
  }
}

export function getComparisonIconType(
  comparisonType: "equal_to" | "less_than" | "greater_than"
): "equal" | "less" | "greater" | null {
  switch (comparisonType) {
    case "equal_to":
      return "equal";
    case "less_than":
      return "less";
    case "greater_than":
      return "greater";
    default:
      return null;
  }
}

export function extractFirstName(fullName: string): string {
  if (!fullName) return "";
  
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    if (parts.length >= 2) {
      const afterComma = parts[1].trim();
      return afterComma.split(/\s+/)[0] || "";
    }
  }
  
  return fullName.split(/\s+/)[0] || "";
}

export function getSenderName(user: User | null | undefined): string | undefined {
  if (!user) return undefined;
  
  if (user.firstName && user.firstName.trim()) {
    return user.firstName.trim();
  }
  
  if (user.lastName && user.lastName.trim()) {
    return extractFirstName(user.lastName);
  }
  
  if (user.email) {
    const emailUsername = user.email.split('@')[0];
    const namePart = emailUsername.split(/[._-]/)[0];
    if (namePart) {
      return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    }
  }
  
  return undefined;
}

export function formatRecipientFirstNames(
  recipients: Array<{ userId: string; name: string | null }>,
  selectedRecipientIds: Set<string>,
  eligibleRecipients: Array<{ userId: string; name: string | null }>
): string {
  const recipientsToUse = selectedRecipientIds.size > 0 
    ? recipients.filter(r => selectedRecipientIds.has(r.userId))
    : eligibleRecipients;
  
  const names = recipientsToUse
    .map(r => extractFirstName(r.name || ""))
    .filter(name => name.length > 0);
  
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  
  const lastTwo = names.slice(-2).join(" and ");
  const rest = names.slice(0, -2);
  return [...rest, lastTwo].join(", ");
}
