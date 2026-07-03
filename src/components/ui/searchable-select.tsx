import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SelectOption {
  label: string;
  value: string;
  /** Optional icon rendered before the label in both trigger and list */
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Shows a × clear button on the trigger when a value is selected */
  clearable?: boolean;
  /** Extra classes applied to the trigger button */
  className?: string;
  /** Custom renderer for each option row in the dropdown */
  renderOption?: (option: SelectOption) => React.ReactNode;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  clearable = false,
  className,
  renderOption,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const NONE = "__none__";
  const isRealValue = !!value && value !== NONE;
  const selected = options.find((opt) => opt.value === value);

  // Float the selected option to the top when not searching.
  const sortedOptions = React.useMemo(() => {
    if (search) return options;
    const idx = options.findIndex((o) => o.value === value);
    if (idx <= 0) return options;
    return [options[idx], ...options.slice(0, idx), ...options.slice(idx + 1)];
  }, [options, value, search]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(NONE);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
            {selected?.icon}
            {selected ? selected.label : placeholder}
          </span>

          <span className="ml-2 flex shrink-0 items-center gap-1">
            {/* Clear button — only shown when clearable and a real value is set */}
            {clearable && isRealValue && (
              <span
                role="button"
                aria-label="Clear selection"
                onClick={handleClear}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[160px] p-0 focus-visible:outline-none focus-visible:ring-0"
        align="start"
      >
        <Command
          className={cn(
            // Override cmdk's default amber-accent hover with a subtle muted tint
            "[&_[cmdk-item]]:cursor-pointer",
            "[&_[cmdk-item][data-selected=true]]:bg-muted [&_[cmdk-item][data-selected=true]]:text-foreground",
            "border-border/40",
            "[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:bg-background [&_[cmdk-input-wrapper]]:px-3",
            "[&_[cmdk-input-wrapper]_svg]:text-muted-foreground",
            "[&_input]:h-9 [&_input]:py-2 [&_input]:text-sm [&_input]:focus-visible:ring-0 [&_input]:focus-visible:outline-none",
            // The dialog content (and cmdk root) uses `overflow-hidden` which can clip the dropdown
            // and its scrollbar inside modals. Force a non-clipping layout.
            "!overflow-visible !h-auto",
          )}
        >
          <CommandInput
            placeholder="Search…"
            autoFocus
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            // Make the scroll container explicit so Radix/dialog scroll-lock wrappers
            // don't end up preventing wheel/trackpad scrolling on the list.
            className="!max-h-[320px] !overflow-y-auto !overflow-x-hidden"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {sortedOptions.map((option) => {
                const isChosen = value === option.value && option.value !== NONE;
                return (
                  <CommandItem
                    key={option.value}
                    // cmdk filters against this — use label for natural text search
                    value={option.label}
                    onSelect={() => {
                      // Clicking the already-chosen item deselects it
                      onChange(isChosen ? NONE : option.value);
                      setSearch("");
                      setOpen(false);
                    }}
                    className={cn(
                      // Chosen item: solid primary (teal) background — highest specificity via !
                      isChosen && "!bg-primary !text-primary-foreground font-medium",
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isChosen ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <span className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
