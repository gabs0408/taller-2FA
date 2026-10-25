import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { generateTOTP, getRemainingSeconds } from './totp';

export default function App() {
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP');
  const [code, setCode] = useState('------');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [backendUrl, setBackendUrl] = useState('http://192.168.1.10:8000');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('secret123');
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Update TOTP code and countdown timer
  useEffect(() => {
    const updateCode = () => {
      try {
        const newCode = generateTOTP(secret);
        setCode(newCode);
      } catch (err) {
        setCode('ERROR');
      }
      setSecondsLeft(getRemainingSeconds());
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  // Step 1: Login to get session / 2FA challenge
  const handleLogin = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Ingresa la URL del backend');
      return;
    }
    setLoading(true);
    setAuthStatus('Iniciando sesión...');
    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setSessionId(data.session_id || data.token || 'active-session');
        setAuthStatus('Paso 1 exitoso: 2FA Requerido');
        Alert.alert('Login Exitoso', 'Credenciales válidas. Procede a verificar el código 2FA.');
      } else {
        setAuthStatus(`Fallo de login: ${data.detail || 'Credenciales inválidas'}`);
        Alert.alert('Error', data.detail || 'No se pudo iniciar sesión');
      }
    } catch (error) {
      setAuthStatus(`Error de conexión: ${error.message}`);
      Alert.alert('Error de Red', `No se pudo conectar a ${backendUrl}. Verifica tu IP.`);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 2FA TOTP code
  const handleVerify2FA = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Ingresa la URL del backend');
      return;
    }
    setLoading(true);
    setAuthStatus('Verificando código 2FA...');
    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          session_id: sessionId,
          username: username,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAuthStatus('¡Autenticación 2FA Exitosa! 🎉');
        Alert.alert('Éxito', '¡Segundo factor verificado correctamente!');
      } else {
        setAuthStatus(`2FA Inválido: ${data.detail || 'Código incorrecto'}`);
        Alert.alert('Falló 2FA', data.detail || 'Código 2FA no válido');
      }
    } catch (error) {
      setAuthStatus(`Error de conexión: ${error.message}`);
      Alert.alert('Error de Red', `No se pudo conectar al backend: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format code with space in middle: "123 456"
  const formattedCode =
    code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  // Percentage of 30 seconds left for progress bar
  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>🛡️ Autenticador 2FA</Text>
          <Text style={styles.subtitle}>Taller de Patrones Arquitectónicos</Text>
        </View>

        {/* TOTP Display Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CÓDIGO DE SEGURIDAD TEMPORAL (TOTP)</Text>
          
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{formattedCode}</Text>
          </View>

          {/* Countdown timer & progress bar */}
          <View style={styles.timerRow}>
            <Text style={styles.timerText}>
              Se actualiza en: <Text style={styles.timerHighlight}>{secondsLeft}s</Text>
            </Text>
          </View>

          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: secondsLeft <= 5 ? '#ef4444' : '#38bdf8',
                },
              ]}
            />
          </View>

          <View style={styles.secretBadge}>
            <Text style={styles.secretText}>Secreto: {secret}</Text>
          </View>
        </View>

        {/* Backend Verification Section */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PROBAR CONEXIÓN CON BACKEND</Text>

          <Text style={styles.inputLabel}>URL del Backend (tu IP local):</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.1.X:8000"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Usuario:</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>Contraseña:</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.loginButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>1. Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.verifyButton]}
              onPress={handleVerify2FA}
              disabled={loading}
            >
              <Text style={styles.buttonText}>2. Validar 2FA</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginTop: 12 }} />
          )}

          {authStatus ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{authStatus}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer info */}
        <Text style={styles.footerText}>
          Estándar RFC 6238 • HMAC-SHA1 • 30 Segundos
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 18,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 14,
  },
  codeContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38bdf840',
  },
  codeText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  timerRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  timerHighlight: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  secretBadge: {
    marginTop: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a80',
    alignItems: 'center',
  },
  secretText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  inputLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#475569',
  },
  verifyButton: {
    backgroundColor: '#0284c7',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf850',
    alignItems: 'center',
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
