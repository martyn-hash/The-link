import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ErrorMapping {
  pattern: RegExp;
  title: string;
  description: string;
  category?: 'validation' | 'duplicate' | 'permission' | 'network' | 'server' | 'notfound';
}

const errorMappings: ErrorMapping[] = [
  {
    pattern: /unique.*primary_phone|primary_phone.*unique|duplicate.*phone|phone.*already|mobile.*unique|unique.*mobile/i,
    title: "Duplicate Phone Number",
    description: "This mobile number is already registered to someone else. Each person needs their own unique phone number - no sharing allowed!",
    category: 'duplicate'
  },
  {
    pattern: /unique.*primary_email|primary_email.*unique|duplicate.*email|email.*already|email.*unique/i,
    title: "Duplicate Email Address",
    description: "This email address is already in use. Please use a different email address - each person needs their own unique email.",
    category: 'duplicate'
  },
  {
    pattern: /unique.*constraint|duplicate key|violates unique/i,
    title: "Duplicate Entry",
    description: "This value already exists in the system. Please use a different value - we need each entry to be unique.",
    category: 'duplicate'
  },
  {
    pattern: /foreign key.*constraint|references.*constraint/i,
    title: "Related Data Exists",
    description: "This item is connected to other data in the system and can't be removed. You'll need to disconnect or remove the related items first.",
    category: 'validation'
  },
  {
    pattern: /not.*null.*constraint|null.*violation|required.*field|is required/i,
    title: "Missing Required Information",
    description: "Some required fields are empty. Please check the form and fill in all the required information (usually marked with *).",
    category: 'validation'
  },
  {
    pattern: /invalid.*email|email.*invalid|email.*format/i,
    title: "Invalid Email Format",
    description: "The email address doesn't look quite right. Please check it follows the format: name@example.com",
    category: 'validation'
  },
  {
    pattern: /invalid.*phone|phone.*invalid|phone.*format/i,
    title: "Invalid Phone Format",
    description: "The phone number doesn't look quite right. Please enter a valid UK phone number.",
    category: 'validation'
  },
  {
    pattern: /password.*short|password.*weak|password.*must/i,
    title: "Password Too Weak",
    description: "Your password needs to be stronger. Try making it longer and including a mix of letters and numbers.",
    category: 'validation'
  },
  {
    pattern: /unauthorized|not authenticated|login required|session expired/i,
    title: "Please Log In",
    description: "Your session has expired or you need to log in to do this. Please refresh the page and log in again.",
    category: 'permission'
  },
  {
    pattern: /forbidden|not allowed|access denied|permission denied|no permission/i,
    title: "Access Restricted",
    description: "You don't have permission to do this. If you think you should have access, please contact an administrator.",
    category: 'permission'
  },
  {
    pattern: /not found|404|does not exist|no such/i,
    title: "Item Not Found",
    description: "We couldn't find what you're looking for. It may have been moved or deleted. Try refreshing the page.",
    category: 'notfound'
  },
  {
    pattern: /network error|fetch failed|connection refused|econnrefused/i,
    title: "Connection Problem",
    description: "We're having trouble connecting to the server. Please check your internet connection and try again.",
    category: 'network'
  },
  {
    pattern: /timeout|timed out|request timeout/i,
    title: "Request Timed Out",
    description: "The server is taking too long to respond. Please try again in a moment - the system might be busy.",
    category: 'network'
  },
  {
    pattern: /500|internal server error|server error/i,
    title: "Server Error",
    description: "Something went wrong on our end. Please try again in a moment. If the problem persists, contact support.",
    category: 'server'
  },
  {
    pattern: /503|service unavailable|maintenance/i,
    title: "Service Temporarily Unavailable",
    description: "The service is temporarily unavailable, possibly for maintenance. Please try again in a few minutes.",
    category: 'server'
  },
  {
    pattern: /too many requests|rate limit|throttle/i,
    title: "Too Many Requests",
    description: "You're making requests too quickly. Please wait a moment and try again.",
    category: 'server'
  },
  {
    pattern: /file.*too large|size.*exceed|upload.*limit/i,
    title: "File Too Large",
    description: "The file you're trying to upload is too big. Please try a smaller file or compress it first.",
    category: 'validation'
  },
  {
    pattern: /invalid.*file.*type|unsupported.*format|file.*format/i,
    title: "Invalid File Type",
    description: "This file type isn't supported. Please try a different format (like PDF, JPG, or PNG).",
    category: 'validation'
  },
  {
    pattern: /date.*invalid|invalid.*date|date.*format/i,
    title: "Invalid Date",
    description: "The date you entered doesn't look right. Please check the format and try again.",
    category: 'validation'
  },
  {
    pattern: /client.*exists|company.*exists|already.*registered/i,
    title: "Client Already Exists",
    description: "A client with this information already exists in the system. Try searching for them instead of creating a new record.",
    category: 'duplicate'
  },
  {
    pattern: /person.*exists|contact.*exists/i,
    title: "Person Already Exists",
    description: "This person is already in the system. Check if they're already linked to a client.",
    category: 'duplicate'
  },
  {
    pattern: /project.*exists|duplicate.*project/i,
    title: "Project Already Exists",
    description: "A project like this already exists. You might want to update the existing project instead.",
    category: 'duplicate'
  },
  {
    pattern: /validation.*error|invalid.*input|invalid.*data/i,
    title: "Invalid Input",
    description: "Some of the information you entered isn't valid. Please check the form for any highlighted fields.",
    category: 'validation'
  },
  {
    pattern: /companies.*house|ch.*api|company.*lookup/i,
    title: "Companies House Issue",
    description: "We're having trouble connecting to Companies House. Please try again in a moment.",
    category: 'network'
  },
  {
    pattern: /email.*send|send.*failed|smtp|mail.*error/i,
    title: "Email Couldn't Be Sent",
    description: "We couldn't send the email. Please check the email address and try again.",
    category: 'server'
  },
  {
    pattern: /sms.*failed|text.*failed|message.*failed/i,
    title: "SMS Couldn't Be Sent",
    description: "We couldn't send the text message. Please check the phone number and try again.",
    category: 'server'
  }
];

function matchError(errorMessage: string): ErrorMapping | null {
  const normalizedMessage = errorMessage.toLowerCase();
  
  for (const mapping of errorMappings) {
    if (mapping.pattern.test(normalizedMessage)) {
      return mapping;
    }
  }
  
  return null;
}

function extractErrorMessage(error: unknown): string {
  let message = '';
  
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') message = err.message;
    else if (typeof err.error === 'string') message = err.error;
    else if (typeof err.detail === 'string') message = err.detail;
    else if (typeof err.statusText === 'string') message = err.statusText;
    else message = 'An unexpected error occurred';
  } else {
    message = 'An unexpected error occurred';
  }
  
  const jsonMatch = message.match(/\d{3}:\s*(\{.+\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.message) message = parsed.message;
      if (parsed.error) message += ` ${parsed.error}`;
      if (parsed.detail) message += ` ${parsed.detail}`;
    } catch {}
  }
  
  return message;
}

let cachedPhrase: { phrase: string; category: string } | null = null;
let phrasePromise: Promise<{ phrase: string; category: string }> | null = null;

async function fetchFunnyPhrase(): Promise<{ phrase: string; category: string }> {
  if (cachedPhrase) {
    const phrase = cachedPhrase;
    cachedPhrase = null;
    prefetchNextPhrase();
    return phrase;
  }
  
  if (phrasePromise) {
    return phrasePromise;
  }
  
  phrasePromise = apiRequest('GET', '/api/friendly-error/phrase')
    .then(data => {
      phrasePromise = null;
      prefetchNextPhrase();
      return data;
    })
    .catch(() => {
      phrasePromise = null;
      return { phrase: "Oops! Something went wrong 😅", category: "fallback" };
    });
  
  return phrasePromise;
}

function prefetchNextPhrase() {
  setTimeout(() => {
    if (!cachedPhrase && !phrasePromise) {
      apiRequest('GET', '/api/friendly-error/phrase')
        .then(data => {
          cachedPhrase = data;
        })
        .catch(() => {});
    }
  }, 1000);
}

export interface FriendlyErrorOptions {
  error: unknown;
  fallbackTitle?: string;
  fallbackDescription?: string;
  showWittyOpener?: boolean;
}

export async function showFriendlyError(options: FriendlyErrorOptions): Promise<void> {
  const {
    error,
    fallbackTitle = "Something Went Wrong",
    fallbackDescription = "Please try again. If the problem continues, contact support.",
    showWittyOpener = true
  } = options;
  
  const errorMessage = extractErrorMessage(error);
  const mapping = matchError(errorMessage);
  
  let title = mapping?.title || fallbackTitle;
  let description = mapping?.description || fallbackDescription;
  
  if (showWittyOpener) {
    try {
      const funnyPhrase = await fetchFunnyPhrase();
      description = `${funnyPhrase.phrase}\n\n${description}`;
    } catch {
    }
  }
  
  toast({
    title,
    description,
    variant: "friendly" as const,
    duration: 8000,
  });
}

export function showFriendlyErrorSync(options: FriendlyErrorOptions): void {
  const {
    error,
    fallbackTitle = "Something Went Wrong",
    fallbackDescription = "Please try again. If the problem continues, contact support.",
  } = options;
  
  const errorMessage = extractErrorMessage(error);
  const mapping = matchError(errorMessage);
  
  toast({
    title: mapping?.title || fallbackTitle,
    description: mapping?.description || fallbackDescription,
    variant: "friendly" as const,
    duration: 8000,
  });
  
  showFriendlyError(options);
}

export function getFriendlyErrorDetails(error: unknown): { title: string; description: string } {
  const errorMessage = extractErrorMessage(error);
  const mapping = matchError(errorMessage);
  
  return {
    title: mapping?.title || "Something Went Wrong",
    description: mapping?.description || "Please try again. If the problem continues, contact support."
  };
}

export { errorMappings, matchError, extractErrorMessage };
