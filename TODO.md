# TODO: Cooling Time Fix and Screen Improvements

## Changes Completed:

### 1. Fix cooling time to 15s ✅
- [x] Updated useEffect condition from `coolingTime < 20` to `coolingTime < 15`
- [x] Updated limit check from `if (next >= 20) return 20;` to `if (next >= 15) return 15;`

### 2. Improve START COOLING screen (Stage 4 pre-start) ✅
- [x] Added animated syngas particle visualization with purple ping particles
- [x] Enabled cooling power slider before starting (now interactive)
- [x] Added cooling chamber preview with flow indicators and pipes
- [x] Improved visual design with glow effects and cyan accents
- [x] Added temperature target indicator (400°C goal with scale)
- [x] Enhanced START COOLING button with gradient, pulsing animation and glow
- [x] Ensured responsive design for all screen sizes (mobile to desktop)

### 3. Testing
- [ ] Verify cooling timer stops at exactly 15s
- [ ] Test responsive layout on different screen sizes
- [ ] Verify all interactive elements work correctly

