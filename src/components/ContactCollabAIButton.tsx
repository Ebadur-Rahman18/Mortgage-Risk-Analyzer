import collabaiLogo from "@/assets/collabai-logo.png?url";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLLABAI_CONTACT_URL =
  (import.meta.env.VITE_COLLABAI_CONTACT_URL as string | undefined) ??
  "https://collabai.software/contact";

export function ContactCollabAIButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={COLLABAI_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact CollabAI"
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-4 sm:right-4 sm:h-12 sm:w-12"
          >
            <img
              src={collabaiLogo}
              alt="CollabAI"
              className="h-8 w-8 object-contain sm:h-7 sm:w-7"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">contact collabAI</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
