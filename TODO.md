# House Price Prediction Error Fix - TODO

## Approved Plan Steps (Status: In Progress)

### Step 1: Create TODO.md [✅ COMPLETE]
- Track progress.

### Step 2: Fix DATA_PATH in house-price-predictor/app.py [⏳ PENDING]
- Change `DATA_PATH = BASE_DIR / "Delhi_v2.csv" / "Delhi_v2.csv"` → `DATA_PATH = BASE_DIR / "Delhi_v2.csv"`
- Add dataset check + error logging.

### Step 3: Test model init [⏳ PENDING]
- Run `python house-price-predictor/app.py --check`
- Expect JSON output with metrics.

### Step 4: Test full server [⏳ PENDING]
- Run `python house-price-predictor/app.py`
- Test `/predict` endpoint.

### Step 5: Verify frontend integration [⏳ PENDING]
- Load `static/index.html`, submit form → success.

### Step 6: Complete & cleanup [⏳ PENDING]
- Update TODO.md ✅
- attempt_completion

**Next Action**: Edit app.py.

