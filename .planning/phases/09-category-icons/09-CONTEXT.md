# Phase 9: Category Icons - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (single-phase autonomous)

## Phase Boundary

User can optionally assign an icon to a category from a preset grid, with a default fallback for existing and unselected categories.

## Implementation Decisions

### Data Model
- Category type: `{ id, name, createdAt, icon?: string }` — optional icon field
- Firestore: `icon` field on category docs (string, preset key)
- Backward-compatible: old docs without `icon` render default (initial letter)

### Preset Icons
- ~20 emoji icons in a grid (4 columns): 🏠 🍔 🚗 💰 🛒 💊 📚 🎭 🎵 💻 🏋️ 🐾 ✈️ 🎂 💇 🏥 📱 🎯 🌿 ☕
- Stored as emoji strings in Firestore
- Grid rendered as a FlatList with 4 columns

### UI Flow
1. User types category name → taps "+"
2. Icon picker modal appears (bottom sheet)
3. User picks an icon OR taps "Skip"
4. Category saved with selected icon (or no icon = default)

### Rendering
- CategorySection: uses `icon` field if present, else initial letter (existing behavior)
- CategoriesScreen: shows icon to left of name
- EntryForm category dropdown: shows icon to left of name
- All use the same `CategoryIcon` component for consistency

### Existing Code
- Category type in CategoriesProvider: `{ id, name, createdAt }`
- addCategory(kind, name) — needs icon parameter
- CategorySection: auto-generates initial letter icons
- CategoriesScreen: plain text rows
- EntryForm category picker: plain text rows

## Specific Ideas

- Create a `CategoryIcon` component that renders either an emoji (if icon is set) or initial letter
- Icon picker is a modal bottom sheet with a 4-column grid of emoji buttons
- "Skip" button at the bottom of the picker
- CategorySection already has icon placeholders — update to use the CategoryIcon component
- EntryForm category dropdown needs icons added to each row

## Deferred Ideas

None — full category icons feature is the scope.
