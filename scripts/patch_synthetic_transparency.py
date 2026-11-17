import re

filepath = 'frontend/src/components/workspace/CropMonitoringDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State addition
t1 = "const [leafPreviewUrl, setLeafPreviewUrl] = useState<string | null>(null);"
r1 = "const [leafPreviewUrl, setLeafPreviewUrl] = useState<string | null>(null);\n\n  const [isSyntheticSample, setIsSyntheticSample] = useState<boolean>(false);"
assert t1 in content, "Target 1 not found"
content = content.replace(t1, r1, 1)

# 2. handleLeafFileChange
t2 = "setSelectedLeafFile(file);\n\n    setLeafPreviewUrl(URL.createObjectURL(file));\n\n    setDiseaseResult(null);"
r2 = "setSelectedLeafFile(file);\n\n    setLeafPreviewUrl(URL.createObjectURL(file));\n\n    setIsSyntheticSample(false);\n\n    setDiseaseResult(null);"
assert t2 in content, "Target 2 not found"
content = content.replace(t2, r2, 1)

# 3. handleGenerateSyntheticSample filename and state
t3 = "`research_${modelId}_sample.png`"
r3 = "'synthetic_research_sample.png'"
assert t3 in content, "Target 3 not found"
content = content.replace(t3, r3, 1)

t4 = "setSelectedLeafFile(file);\n\n      setLeafPreviewUrl(URL.createObjectURL(file));\n\n    }, 'image/png');"
r4 = "setSelectedLeafFile(file);\n\n      setLeafPreviewUrl(URL.createObjectURL(file));\n\n      setIsSyntheticSample(true);\n\n    }, 'image/png');"
assert t4 in content, "Target 4 not found"
content = content.replace(t4, r4, 1)

# 4. handleResetLeafFile
t5 = "setSelectedLeafFile(null);\n\n    setLeafPreviewUrl(null);\n\n    setDiseaseResult(null);"
r5 = "setSelectedLeafFile(null);\n\n    setLeafPreviewUrl(null);\n\n    setIsSyntheticSample(false);\n\n    setDiseaseResult(null);"
assert t5 in content, "Target 5 not found"
content = content.replace(t5, r5, 1)

# 5. Preview badge
t6 = "{selectedLeafFile && leafPreviewUrl ? (\n\n                      <div className=\"space-y-3\">\n\n                        <img"
r6 = """{selectedLeafFile && leafPreviewUrl ? (

                      <div className="space-y-3">

                        {isSyntheticSample && (

                          <div

                            data-testid="synthetic-sample-badge"

                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bengali font-medium"

                          >

                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />

                            <span>{t('কৃত্রিম ল্যাব নমুনা — মাঠের বাস্তব ফলাফল নয়', 'Synthetic Lab Sample — Not a Field Diagnosis')}</span>

                          </div>

                        )}

                        <img"""
assert t6 in content, "Target 6 not found"
content = content.replace(t6, r6, 1)

# 6. Button text
t7 = "<span>{t('গবেষণা টেস্ট পাতা লোড করুন', 'Load Research Leaf Sample')}</span>"
r7 = "<span>{t('ডেমো / কৃত্রিম নমুনা পাতা লোড করুন', 'Load Demo / Synthetic Research Sample')}</span>"
assert t7 in content, "Target 7 not found"
content = content.replace(t7, r7, 1)

# 7. Result card badge
t8 = """<span className="text-[11px] font-mono text-sage-400">

                          #{diseaseResult.record_id || 'unlogged'}

                        </span>

                      </div>



                      {/* Top Diagnosis */}"""

r8 = """<span className="text-[11px] font-mono text-sage-400">

                          #{diseaseResult.record_id || 'unlogged'}

                        </span>

                      </div>



                      {isSyntheticSample && (

                        <div

                          data-testid="result-synthetic-warning"

                          className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bengali flex items-center gap-2"

                        >

                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />

                          <span>{t('কৃত্রিম ল্যাব নমুনা — মাঠের বাস্তব ফলাফল নয়', 'Synthetic Lab Sample — Not a Field Diagnosis')}</span>

                        </div>

                      )}



                      {/* Top Diagnosis */}"""
assert t8 in content, "Target 8 not found"
content = content.replace(t8, r8, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied all synthetic transparency enhancements to CropMonitoringDashboard.tsx!")

