async function test() {
  try {
    // 1. Verify OTP
    const verifyRes = await fetch('http://localhost:3000/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'medico@sgp.com', otp: '198913' })
    });
    
    let verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
        // En caso de que el usuario haya escrito medicol@sgp.com
        const verifyRes2 = await fetch('http://localhost:3000/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: 'medicol@sgp.com', otp: '198913' })
        });
        verifyData = await verifyRes2.json();
    }
    
    console.log('OTP Verify Result:', verifyData);
    
    if (!verifyData.accessToken) {
        console.error('No se pudo obtener el token. Quizás el OTP expiró o ya fue usado.');
        return;
    }
    
    const token = verifyData.accessToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // 2. Buscar Medicamentos
    const medRes = await fetch('http://localhost:3000/api/medicamentos/buscar?q=ibu', { headers });
    const medData = await medRes.json();
    console.log('---');
    console.log('Búsqueda de Medicamentos (q=ibu):', medData);
    
    // 3. Buscar Pacientes (Historial)
    const pacRes = await fetch('http://localhost:3000/api/historial/pacientes/buscar?nombre=a', { headers });
    const pacData = await pacRes.json();
    console.log('---');
    console.log('Búsqueda de Pacientes:', pacData);
    
  } catch (err) {
    console.error('Error durante la ejecución del script:', err);
  }
}

test();
