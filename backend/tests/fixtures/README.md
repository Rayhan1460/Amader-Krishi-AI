# Test Image Fixtures for Crop Disease AI Verification

This directory contains verified JPEG test fixtures for validating image-based disease inference in `backend/tests`:

1. `test_tomato_leaf.jpg`:
   - Dimensions: 400x400 RGB JPEG
   - Provenance: Generated test fixture with verified leaf morphology, compound leaflet structure, serration, and concentric early blight lesion characteristics.
   - Purpose: Validates complete upload, preprocessing (EXIF transpose, RGB conversion, aspect ratio handling, 224x224 scaling), and real Keras inference through `tomato_disease_v3`.

2. `test_rice_leaf.jpg`:
   - Dimensions: 400x400 RGB JPEG
   - Provenance: Generated test fixture with verified elongated linear lanceolate rice blade, parallel veins, and spindle-shaped blast lesion with necrotic margins.
   - Purpose: Validates complete upload, preprocessing, and real Keras inference through `rice_disease`.

### Scientific Disclaimers:
- These image fixtures are strictly for automated integration and regression testing of backend pipelines.
- They do not represent clinical agronomic samples.

