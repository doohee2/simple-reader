---
name: Simple Reader
colors:
  surface: '#15121b'
  surface-dim: '#15121b'
  surface-bright: '#3b3742'
  surface-container-lowest: '#0f0d15'
  surface-container-low: '#1d1a23'
  surface-container: '#211e27'
  surface-container-high: '#2c2832'
  surface-container-highest: '#37333d'
  on-surface: '#e7e0ed'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e7e0ed'
  inverse-on-surface: '#322f39'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#15121b'
  on-background: '#e7e0ed'
  surface-variant: '#37333d'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  reading-body:
    fontFamily: Merriweather
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 32px
  reading-body-mobile:
    fontFamily: Merriweather
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  ui-body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  ui-label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  ui-label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1440px
  sidebar-width: 280px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is built for a focused, high-performance reading environment. It targets academics, researchers, and students who require long-form reading sessions without visual fatigue. The brand personality is **calm, precise, and unobtrusive**, ensuring that the content—the PDF—remains the protagonist.

The design style is **Corporate / Modern** with a lean toward **Minimalism**. It utilizes expansive negative space, high-quality typography, and a "content-first" hierarchy. By stripping away decorative elements, the system focuses on functional utility and clarity, evoking an emotional response of organized tranquility.

## Colors

The palette is anchored in deep Slates and Zincs to provide a sophisticated, low-glare foundation. 

- **Primary (#8B5CF6):** A Gemini-inspired Violet used for focus states, active selections, and primary calls to action. It provides a technical, forward-thinking edge to the academic aesthetic.
- **Secondary (#10B981):** An Emerald Green used for success states, "read" markers, and positive progress indicators.
- **Neutrals:** The background defaults to Slate-900 for dark mode to reduce eye strain, while light mode uses Slate-50 for a crisp, paper-like feel. 

The color application should be sparse, used primarily to guide attention rather than decorate.

## Typography

The system employs a dual-font strategy. **Inter** handles all UI elements, navigation, and metadata, providing a neutral and highly legible interface. **Merriweather** is reserved specifically for the PDF simulation and long-form reading modes, leveraging its serif structure to improve horizontal flow and reduce cognitive load during deep work.

- **UI Text:** Uses Inter with tight letter spacing for a modern, "app" feel.
- **Reading Text:** Uses Merriweather with generous line heights (1.7x+) to prevent line-skipping.
- **Mobile Scale:** Headline sizes are reduced by 25% on mobile devices, while body text remains large for accessibility.

## Layout & Spacing

This design system utilizes a **Fixed-Fluid Hybrid** layout. 
- **Sidebars (Library/Annotations):** Fixed width (280px) and collapsible.
- **Reading Canvas:** Fluid center area that prioritizes the aspect ratio of the document.
- **Grid:** A 12-column grid for the library view; a single-column focused layout for the reader view.

Spacing follows a 4px baseline grid. Components use generous internal padding to create a sense of "breathability," essential for an app where users spend hours staring at a screen.

## Elevation & Depth

To maintain a sophisticated and minimal aesthetic, depth is communicated through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Background):** Base Slate-900 (Dark) or Slate-50 (Light).
- **Level 1 (Panels):** Slightly lighter/darker surface with a 1px border (Slate-800/200).
- **Level 2 (Popovers/Tooltips):** Uses a subtle backdrop blur (8px) and a low-opacity ambient shadow (0px 4px 12px rgba(0,0,0,0.1)) to appear floated.
- **Active State:** Elements like active tabs or selected text use the Primary Violet color with a 10% opacity glow for "soft" highlighting.

## Shapes

The system uses **Soft (0.25rem)** roundedness to strike a balance between the precision of an academic tool and the approachability of a modern app. 

- **Small Components (Buttons, Inputs):** 4px (0.25rem) radius.
- **Medium Components (Cards, Bottom Sheets):** 8px (0.5rem) radius.
- **Large Components (Modals):** 12px (0.75rem) radius.
- **Indicators:** Progress bars and status badges use pill-shapes (full rounding) to contrast against the structured grid.

## Components

- **Primary Buttons:** Solid Violet fill with white text. High contrast, clear hierarchy.
- **Secondary Buttons:** Ghost style with 1px Slate border.
- **Resizable Panels:** Use a subtle vertical handle (2px width) that changes color to Violet on hover to indicate interactivity.
- **Floating Tooltips:** Dark Slate background with a 1px Violet border; used for quick dictionary lookups or annotation tools.
- **Bottom Sheets (Mobile):** Feature a 40px drag handle at the top, used for document settings and table of contents.
- **Status Badges:** Emerald for 'Completed', Violet for 'In Progress', and Zinc for 'Archived'. Text is uppercase Inter (12px) with 0.05em tracking.
- **Tabbed Navigation:** Underline style for the main reader; the underline is 2px Violet and spans the width of the label.