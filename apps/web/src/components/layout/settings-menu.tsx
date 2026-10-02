import { Settings } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  readThemePreference,
  setThemePreference,
  THEME_PREFERENCE,
  type ThemePreference,
} from '@/lib/theme';

const THEME_LABEL: Record<ThemePreference, string> = {
  [THEME_PREFERENCE.DEVICE]: 'Gerätestandard',
  [THEME_PREFERENCE.LIGHT]: 'Hell',
  [THEME_PREFERENCE.DARK]: 'Dunkel',
};
const THEME_ORDER = [
  THEME_PREFERENCE.DEVICE,
  THEME_PREFERENCE.LIGHT,
  THEME_PREFERENCE.DARK,
] as const;

/**
 * The gear in the header: the look of the app, which follows the device unless told otherwise. The
 * three choices stand in the menu itself: a submenu does not fit beside it on a phone.
 */
export function SettingsMenu() {
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9"
          aria-label="Einstellungen"
          tooltip="Einstellungen"
        >
          <Settings />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Darstellung</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            const chosen = THEME_ORDER.find((entry) => entry === value);
            if (!chosen) return;
            setTheme(chosen);
            setThemePreference(chosen);
          }}
        >
          {THEME_ORDER.map((entry) => (
            <DropdownMenuRadioItem key={entry} value={entry}>
              {THEME_LABEL[entry]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
