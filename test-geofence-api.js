// Test script for geofence API endpoints
const API_BASE = 'http://localhost:3000/api';

async function testGeofenceAPI() {
    console.log('🧪 Testing Geofence API Endpoints...\n');

    let createdGeofenceId = null;

    try {
        // Test 1: Create a geofence
        console.log('1️⃣ Testing POST /api/geofences (Create)');
        const createResponse = await fetch(`${API_BASE}/geofences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Warehouse',
                type: 'circle',
                center: { lat: 28.6139, lng: 77.2090 },
                radius: 1000,
                color: '#3b82f6',
                alertOnEntry: true,
                alertOnExit: true,
                description: 'Test geofence for API validation'
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Create failed: ${createResponse.status}`);
        }

        const createData = await createResponse.json();
        createdGeofenceId = createData.geofence._id;
        console.log('✅ Geofence created successfully');
        console.log(`   ID: ${createdGeofenceId}`);
        console.log(`   Name: ${createData.geofence.name}\n`);

        // Test 2: Get all geofences
        console.log('2️⃣ Testing GET /api/geofences (Get All)');
        const getAllResponse = await fetch(`${API_BASE}/geofences`);

        if (!getAllResponse.ok) {
            throw new Error(`Get all failed: ${getAllResponse.status}`);
        }

        const getAllData = await getAllResponse.json();
        console.log(`✅ Retrieved ${getAllData.count} geofence(s)\n`);

        // Test 3: Get geofence by ID
        console.log('3️⃣ Testing GET /api/geofences/:id (Get by ID)');
        const getByIdResponse = await fetch(`${API_BASE}/geofences/${createdGeofenceId}`);

        if (!getByIdResponse.ok) {
            throw new Error(`Get by ID failed: ${getByIdResponse.status}`);
        }

        const getByIdData = await getByIdResponse.json();
        console.log('✅ Retrieved geofence by ID');
        console.log(`   Name: ${getByIdData.geofence.name}`);
        console.log(`   Active: ${getByIdData.geofence.active}\n`);

        // Test 4: Update geofence
        console.log('4️⃣ Testing PUT /api/geofences/:id (Update)');
        const updateResponse = await fetch(`${API_BASE}/geofences/${createdGeofenceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Updated Test Warehouse',
                radius: 1500
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Update failed: ${updateResponse.status}`);
        }

        const updateData = await updateResponse.json();
        console.log('✅ Geofence updated successfully');
        console.log(`   New name: ${updateData.geofence.name}`);
        console.log(`   New radius: ${updateData.geofence.radius}m\n`);

        // Test 5: Toggle geofence
        console.log('5️⃣ Testing PATCH /api/geofences/:id/toggle (Toggle)');
        const toggleResponse = await fetch(`${API_BASE}/geofences/${createdGeofenceId}/toggle`, {
            method: 'PATCH'
        });

        if (!toggleResponse.ok) {
            throw new Error(`Toggle failed: ${toggleResponse.status}`);
        }

        const toggleData = await toggleResponse.json();
        console.log('✅ Geofence toggled successfully');
        console.log(`   Active status: ${toggleData.geofence.active}\n`);

        // Test 6: Delete geofence
        console.log('6️⃣ Testing DELETE /api/geofences/:id (Delete)');
        const deleteResponse = await fetch(`${API_BASE}/geofences/${createdGeofenceId}`, {
            method: 'DELETE'
        });

        if (!deleteResponse.ok) {
            throw new Error(`Delete failed: ${deleteResponse.status}`);
        }

        console.log('✅ Geofence deleted successfully\n');

        // Final summary
        console.log('═══════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════');
        console.log('API endpoints are working correctly:');
        console.log('  ✓ POST   /api/geofences');
        console.log('  ✓ GET    /api/geofences');
        console.log('  ✓ GET    /api/geofences/:id');
        console.log('  ✓ PUT    /api/geofences/:id');
        console.log('  ✓ PATCH  /api/geofences/:id/toggle');
        console.log('  ✓ DELETE /api/geofences/:id');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('Error details:', error);

        // Cleanup if geofence was created
        if (createdGeofenceId) {
            console.log('\n🧹 Cleaning up test geofence...');
            try {
                await fetch(`${API_BASE}/geofences/${createdGeofenceId}`, {
                    method: 'DELETE'
                });
                console.log('✅ Cleanup successful');
            } catch (cleanupError) {
                console.error('❌ Cleanup failed:', cleanupError.message);
            }
        }
    }
}

// Run the tests
testGeofenceAPI();
