```markdown
# Design System Strategy: The Empathetic Intelligence

This design system is engineered to bridge the gap between clinical authority and human warmth. In a psychological context, the interface must act as a "Digital Sanctuary"—a space that feels secure, quiet, and deeply intentional. We move away from the aggressive "tech-forward" aesthetic into a high-end editorial experience that prioritizes cognitive ease and emotional safety.

---

### 1. Creative North Star: "The Digital Sanctuary"
The system is built on the concept of **Quiet Authority**. We reject the cluttered "dashboard" look in favor of a curated, editorial layout. 

*   **Intentional Asymmetry:** Use the `16` (5.5rem) and `20` (7rem) spacing tokens to create wide, asymmetrical margins that allow content to breathe.
*   **Layered Transparency:** Instead of rigid boxes, we use overlapping surfaces to create a sense of depth, mimicking the complexity of the human mind.
*   **Soft Sophistication:** We utilize high-contrast typography scales (pairing the expansive `display-lg` with tight `label-sm`) to create a professional, magazine-like feel that establishes trust through design excellence.

---

### 2. Colors & Surface Architecture
Our palette uses a vibrant yet soft purple (`primary: #811cd9`) as a beacon of insight against a calming, multi-tonal grey and lavender landscape.

*   **The "No-Line" Rule:** Explicitly prohibit 1px solid borders for sectioning. Structural definition must be achieved through background shifts. For example, a `surface-container-low` section should sit directly on a `surface` background to define its boundary.
*   **The Glass & Gradient Rule:** For primary CTAs and AI-interfaced elements, use a linear gradient from `primary` (#811cd9) to `primary_container` (#c185ff) at a 135-degree angle. This adds "soul" and dimensionality that flat hex codes lack.
*   **Surface Hierarchy (Nesting):**
    *   **Base:** `surface` (#f6f6fb) for the main viewport.
    *   **Sectioning:** `surface_container_low` (#f0f0f6) for large content areas.
    *   **Interactive Layers:** `surface_container_lowest` (#ffffff) for cards and floating menus.
    *   **Depth:** Use `surface_variant` (#dbdde3) sparingly for deactivated or backgrounded elements.

---

### 3. Typography: The Editorial Voice
We use a dual-typeface system to balance modern tech with human-centric softness.

*   **Headlines (Plus Jakarta Sans):** Chosen for its modern, geometric clarity with a friendly "aperture." Use `display-lg` (3.5rem) for hero statements to evoke confidence.
*   **Body (Manrope):** A highly legible, soft sans-serif that remains approachable even in dense psychological articles. 
*   **Hierarchy as Brand:** Always maintain a significant jump between `headline-md` and `body-md`. The generous white space between these levels is what creates the "premium" feel. Use `label-md` in `on_surface_variant` (#5a5b60) for metadata to ensure it feels secondary but organized.

---

### 4. Elevation & Depth: Tonal Stacking
Standard drop shadows are too "digital." We utilize **Tonal Layering** to convey hierarchy.

*   **The Layering Principle:** Place a `surface_container_lowest` card on top of a `surface_container` background. The subtle shift in hex code provides enough contrast to signify "lift" without visual noise.
*   **Ambient Shadows:** If a floating element (like an AI Chat bubble) requires a shadow, use a blur of `24px` with a 4% opacity of `on_secondary_fixed_variant` (#56497c). This creates a purple-tinted ambient glow rather than a grey "dirt" shadow.
*   **Glassmorphism:** For the AI navigation bar or floating tooltips, use `surface_container_lowest` at 80% opacity with a `blur(12px)` backdrop filter. This allows the calming lavender accents to bleed through the interface.

---

### 5. Components & UI Patterns

#### AI Chat Interface
*   **The "Vessel" Look:** Chat bubbles should not have tails. Use `md` (0.75rem) roundedness for user messages (`secondary_container`) and `xl` (1.5rem) for AI responses (`surface_container_lowest`).
*   **Visual Pulse:** While the AI "thinks," use a subtle pulse animation on a `primary_fixed_dim` (#b772ff) orb rather than a standard loading bar.

#### Article Cards
*   **Forbid Dividers:** Use `3` (1rem) spacing to separate the headline from the summary.
*   **Composition:** A `surface_container_lowest` background with `lg` (1rem) corner radius. Metadata (reading time/category) should use `label-sm` in a `tertiary` color token.

#### Buttons
*   **Primary:** Gradient from `primary` to `primary_container`. Text in `on_primary`. Shape: `full` (pill) to maximize "empathy" and softness.
*   **Tertiary:** No background or border. Use `primary` text with an icon. On hover, apply a `surface_container_high` background.

#### Inputs
*   **The "Ghost" Style:** Input fields should use `surface_container_highest` (#dbdde3) with no border. On focus, transition the background to `surface_container_lowest` and add a `2px` "Ghost Border" using `primary` at 20% opacity.

---

### 6. Do’s and Don’ts

**Do:**
*   **Do** use asymmetrical padding (e.g., more padding on the left of a text block than the right) to create an editorial, high-end feel.
*   **Do** use `primary_fixed` (#c185ff) for subtle highlights in text or small iconography.
*   **Do** prioritize vertical rhythm using the `8` (2.75rem) and `12` (4rem) spacing tokens between major sections.

**Don’t:**
*   **Don’t** use 100% black (#000000) for text. Use `on_surface` (#2d2f33) to maintain a softer contrast ratio that is easier on the eyes during long reading sessions.
*   **Don’t** use hard 90-degree corners. Even for large sections, a minimum of `sm` (0.25rem) roundedness is required to maintain the "empathetic" brand promise.
*   **Don’t** use standard "Success Green" or "Warning Yellow" if possible. Pivot these states toward our `tertiary` and `secondary` lavender/purple ranges to maintain the color story, using `error` (#b41340) only for critical failures.

---

### 7. Signature Elements
*   **The Calming Gradient Mesh:** In the background of the hero section, use a slow-moving mesh gradient of `surface_bright`, `primary_container`, and `secondary_fixed`. This provides a "living" quality to the platform that feels responsive to the user's presence.
*   **Micro-interactions:** Elements should "float" into place using a `cubic-bezier(0.34, 1.56, 0.64, 1)` easing function, giving a soft, springy, and human-like movement to the UI.