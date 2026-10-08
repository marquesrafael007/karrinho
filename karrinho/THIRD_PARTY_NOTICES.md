# Reacticx

The Animated Input Bar, Segmented Control and Pressable components were copied
using the Reacticx CLI 0.2.0 on 2026-10-01. Upstream:
https://github.com/rit3zh/reacticx

Locations: `src/components/base/animated-input-bar`,
`src/components/organisms/segmented-control`, `src/components/atoms/pressable`.

Local adaptations cover Expo SDK 57 types, controlled input clearing, forwarding
focus handlers and accessibility states, single application of button styles,
live reduced-motion preferences, larger-text layouts, keyboard-operated filters,
minimum touch areas, optional blur/pan gestures and configurable indicator borders.
These files are intentionally customized; review an upstream diff before updating.

The existing Reacticx Animated Chip (`src/components/molecules/animated-chip`)
is reused for bottom navigation, with local adaptations for accessible tab names,
web selection states, reduced motion, larger text and safe haptic handling.

## MIT License

Copyright (c) 2026 rit3zh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
