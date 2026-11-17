# End-to-End Integration Test for AgriSphere AI Phase D2
# Tests Chat Sessions, Conversational Messages, All 7 Prediction Endpoints,
# Database Audit History, and Cross-User Isolation

import requests
import uuid
import base64
import io
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"


def run_d2_e2e_tests():
    print("=================================================================")
    print("AGRISPHERE AI — PHASE D2 FULL SYSTEM INTEGRATION TEST")
    print("=================================================================")

    # Step 1: Create a test user
    unique_id = uuid.uuid4().hex[:6]
    username_a = f"agronomist_{unique_id}"
    password_a = "AgriPass1234!"
    email_a = f"{username_a}@agrisphere.test"

    print(f"\n1. Registering User A ({username_a})...")
    reg_resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={"username": username_a, "password": password_a, "email": email_a},
    )
    assert reg_resp.status_code == 201, f"User A registration failed: {reg_resp.text}"
    token_a = reg_resp.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("User A registered and authenticated successfully.")

    # Step 2: Test Chat Session Creation
    print("\n2. Testing Chat Session Creation...")
    chat_create_resp = requests.post(
        f"{BASE_URL}/chat/sessions",
        headers=headers_a,
        json={"title": "Rice & Tomato Field Consultation"},
    )
    assert chat_create_resp.status_code == 201, f"Chat session creation failed: {chat_create_resp.text}"
    session_data = chat_create_resp.json()
    session_id = session_data["id"]
    print(f"Created Chat Session #{session_id} with title: '{session_data['title']}'")
    assert len(session_data["messages"]) >= 1, "Expected initial assistant welcome message"

    # Step 3: Test Posting a Message in Chat Session
    print("\n3. Testing Sending Chat Message...")
    msg_resp = requests.post(
        f"{BASE_URL}/chat/sessions/{session_id}/messages",
        headers=headers_a,
        json={"content": "I notice early blight lesions on my tomato leaves in Bogura."},
    )
    assert msg_resp.status_code == 200, f"Posting chat message failed: {msg_resp.text}"
    updated_session = msg_resp.json()
    print("Chat message sent. Total messages in session:", len(updated_session["messages"]))
    latest_reply = updated_session["messages"][-1]
    assert latest_reply["role"] == "assistant"
    print(f"Assistant Reply Preview: {latest_reply['content'][:120]}...")

    # Step 4: Generate a 224x224 RGB image for vision tests
    def make_leaf_image(color=(34, 139, 34)):
        img = Image.new("RGB", (224, 224), color=color)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    # Step 5: Test Model 1 - tomato_disease_v3
    print("\n4. Testing Model 1: tomato_disease_v3 (Multipart upload)...")
    leaf_bytes = make_leaf_image((50, 160, 50))
    p1_resp = requests.post(
        f"{BASE_URL}/predict/tomato_disease_v3",
        headers=headers_a,
        files={"image_file": ("leaf.jpg", io.BytesIO(leaf_bytes), "image/jpeg")},
    )
    assert p1_resp.status_code == 200, f"tomato_disease_v3 failed: {p1_resp.text}"
    p1 = p1_resp.json()
    print(f"Tomato Prediction: {p1['prediction']['predicted_class']} (Confidence: {p1['prediction']['confidence']:.3f})")

    # Step 6: Test Model 2 - rice_disease
    print("\n5. Testing Model 2: rice_disease (Base64 payload)...")
    rice_bytes = make_leaf_image((30, 120, 30))
    rice_b64 = base64.b64encode(rice_bytes).decode("utf-8")
    p2_resp = requests.post(
        f"{BASE_URL}/predict/rice_disease",
        headers=headers_a,
        json={"image_base64": rice_b64},
    )
    assert p2_resp.status_code == 200, f"rice_disease failed: {p2_resp.text}"
    p2 = p2_resp.json()
    print(f"Rice Prediction: {p2['prediction']['predicted_class']} (Confidence: {p2['prediction']['confidence']:.3f})")

    # Step 7: Test Model 3 - crop_recommendation
    print("\n6. Testing Model 3: crop_recommendation...")
    crop_payload = {
        "N": 90.0, "P": 42.0, "K": 43.0,
        "temperature": 20.8, "humidity": 82.0,
        "ph": 6.5, "rainfall": 202.9
    }
    p3_resp = requests.post(
        f"{BASE_URL}/predict/crop_recommendation",
        headers=headers_a,
        json={"data": crop_payload},
    )
    assert p3_resp.status_code == 200, f"crop_recommendation failed: {p3_resp.text}"
    p3 = p3_resp.json()
    print(f"Recommended Crop: {p3['prediction']['recommended_crop']}")

    # Step 8: Test Model 4 - regional_crop_yield
    print("\n7. Testing Model 4: regional_crop_yield...")
    yield_payload = {
        "District": "Rangpur", "Crop": "Rice", "Season": "Aman",
        "Area_Acres": 15.0, "Mean_Temperature_C": 26.5,
        "Total_Rainfall_mm": 850.0, "Mean_NDVI": 0.55
    }
    p4_resp = requests.post(
        f"{BASE_URL}/predict/regional_crop_yield",
        headers=headers_a,
        json={"data": yield_payload},
    )
    assert p4_resp.status_code == 200, f"regional_crop_yield failed: {p4_resp.text}"
    p4 = p4_resp.json()
    print(f"Predicted Yield: {p4['prediction']['predicted_yield']:.2f} Metric Tons")

    # Step 9: Test Model 5 - flood_susceptibility
    print("\n8. Testing Model 5: flood_susceptibility...")
    flood_payload = {
        "elevation_m": 8.5, "slope_deg": 0.8, "dist_to_river_m": 250.0,
        "drainage_density_km_per_km2": 2.5, "landcover_class": "10"
    }
    p5_resp = requests.post(
        f"{BASE_URL}/predict/flood_susceptibility",
        headers=headers_a,
        json={"data": flood_payload},
    )
    assert p5_resp.status_code == 200, f"flood_susceptibility failed: {p5_resp.text}"
    p5 = p5_resp.json()
    print(f"Flood Risk: {p5['prediction']['predicted_label']} (Class {p5['prediction']['predicted_class']})")

    # Step 10: Test Model 6 - tomato_price
    print("\n9. Testing Model 6: tomato_price (Wholesale Price)...")
    price_payload = {
        "lag_1": 120.0, "lag_2": 110.0, "lag_3": 95.0, "lag_4": 90.0,
        "lag_8": 85.0, "lag_12": 70.0, "past_mean_4": 103.75, "past_mean_8": 96.0,
        "month": 8, "week_of_month": 2
    }
    p6_resp = requests.post(
        f"{BASE_URL}/predict/tomato_price",
        headers=headers_a,
        json={"data": price_payload},
    )
    assert p6_resp.status_code == 200, f"tomato_price failed: {p6_resp.text}"
    p6 = p6_resp.json()
    print(f"Tomato Recommended Price: {p6['prediction']['recommended_price']} BDT/kg (Baseline: {p6['prediction']['recommended_price']} BDT/kg)")

    # Step 11: Test Model 7 - boro_rice_price
    print("\n10. Testing Model 7: boro_rice_price (Wholesale Price)...")
    rice_price_payload = {
        "lag_1": 52.5, "lag_2": 52.0, "lag_3": 51.8, "lag_4": 51.5,
        "lag_8": 50.2, "lag_12": 49.8, "past_mean_4": 51.95, "past_mean_8": 51.10,
        "month": 11, "week_of_month": 1
    }
    p7_resp = requests.post(
        f"{BASE_URL}/predict/boro_rice_price",
        headers=headers_a,
        json={"data": rice_price_payload},
    )
    assert p7_resp.status_code == 200, f"boro_rice_price failed: {p7_resp.text}"
    p7 = p7_resp.json()
    print(f"Rice Recommended Price: {p7['prediction']['recommended_price']} BDT/kg")

    # Step 12: Verify Prediction History Logging
    print("\n11. Verifying Database Prediction History...")
    hist_resp = requests.get(f"{BASE_URL}/history/", headers=headers_a)
    assert hist_resp.status_code == 200, f"History fetch failed: {hist_resp.text}"
    history_records = hist_resp.json()
    print(f"Total Logged Records for User A: {len(history_records)}")
    assert len(history_records) >= 7, f"Expected at least 7 logged records, found {len(history_records)}"

    # Step 13: Test Cross-User Isolation
    print("\n12. Testing Cross-User Isolation...")
    user_b_name = f"user_b_{unique_id}"
    reg_b = requests.post(
        f"{BASE_URL}/auth/register",
        json={"username": user_b_name, "password": "PasswordB123!"},
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B tries to view User A's chat session
    forbidden_chat = requests.get(f"{BASE_URL}/chat/sessions/{session_id}", headers=headers_b)
    assert forbidden_chat.status_code == 403, f"Expected 403 when User B accesses User A's session, got {forbidden_chat.status_code}"
    print("Cross-user chat access isolation verified (HTTP 403).")

    # User B tries to view User A's prediction record
    first_rec = history_records[0]["id"]
    forbidden_rec = requests.get(f"{BASE_URL}/history/{first_rec}", headers=headers_b)
    assert forbidden_rec.status_code == 403, f"Expected 403 when User B accesses User A's record, got {forbidden_rec.status_code}"
    print("Cross-user prediction record isolation verified (HTTP 403).")

    print("\n=================================================================")
    print(">>> ALL 12 PHASE D2 INTEGRATION TESTS PASSED WITH 100% SUCCESS! <<<")
    print("=================================================================")


if __name__ == "__main__":
    run_d2_e2e_tests()
