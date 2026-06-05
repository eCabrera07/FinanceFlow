from fastapi.testclient import TestClient
from main import app
from spreadsheet import template_service
import warnings
warnings.filterwarnings('ignore')

# Save original path
original_path = template_service.TEMPLATE_PATH

# Test normal case first
client = TestClient(app)
response = client.get('/spreadsheet/template/download')
print(f'Test 1 - Normal case: Status={response.status_code}, Expected=200')
assert response.status_code == 200, "Test 1 failed"

# Test 500 error case
template_service.TEMPLATE_PATH = '/nonexistent/path/file.xlsx'
response = client.get('/spreadsheet/template/download')
print(f'Test 2 - 500 error case: Status={response.status_code}, Expected=500')
assert response.status_code == 500, f"Test 2a failed: got {response.status_code}"
has_detail = 'detail' in response.json()
print(f'Test 2 - Response has detail: {has_detail}, Expected=True')
assert has_detail, "Test 2b failed: no detail in response"

# Restore
template_service.TEMPLATE_PATH = original_path
print('All manual tests passed!')
