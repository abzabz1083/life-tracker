/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#20231F',
    tint: '#365244',

    // Core surfaces
    background: '#F4F5F1',
    foreground: '#20231F',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#20231F',

    // Primary action color (buttons, links, active states)
    primary: '#365244',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EDF0EB',
    secondaryForeground: '#20231F',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF0EB',
    mutedForeground: '#777F77',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#E1E8E0',
    accentForeground: '#26382D',

    // Destructive actions (delete, error states)
    destructive: '#A24E45',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#E1E5DF',
    input: '#E1E5DF',
  },

  dark: {
    text: '#F3F4EF',
    tint: '#B8CBBE',
    background: '#151815',
    foreground: '#F3F4EF',
    card: '#1F231F',
    cardForeground: '#F3F4EF',
    primary: '#B8CBBE',
    primaryForeground: '#182019',
    secondary: '#292E29',
    secondaryForeground: '#F3F4EF',
    muted: '#292E29',
    mutedForeground: '#A2AAA1',
    accent: '#343D35',
    accentForeground: '#F3F4EF',
    destructive: '#E18D82',
    destructiveForeground: '#251310',
    border: '#343A34',
    input: '#343A34',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export default colors;
