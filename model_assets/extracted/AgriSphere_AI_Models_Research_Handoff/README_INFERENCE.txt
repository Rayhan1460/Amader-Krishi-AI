IMAGE: Use PIL ImageOps.exif_transpose(image).convert("RGB"), then tf.image.resize(np.asarray(img,dtype=np.float32),[224,224]). Add batch axis. DO NOT multiply or divide by 255; models include their own scaling. Index output into included class_names.json.

TABULAR: joblib.load(model.joblib) from trusted handoff, create pandas.DataFrame([one_real_record], columns=manifest.input_spec.features), then model.predict(df). For flood use predict_proba if calibration and review are appropriate. The smoke placeholder values in tests are NOT field inputs.

PRICE: Use real chronological observations: lag_1,lag_2,lag_3,lag_4,lag_8,lag_12, past_mean_4, past_mean_8, month, week_of_month. Wholesale midpoint originally per quintal was converted to BDT/kg by /100. Baseline forecast = last observed wholesale BDT/kg. Both ML models currently underperform this baseline on held-out data.
