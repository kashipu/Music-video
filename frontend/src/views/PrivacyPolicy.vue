<script setup>
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'
import logoPositive from '../assets/logo-color-positivo.svg'
import logoNegative from '../assets/logo-color-negativo.svg'

const router = useRouter()
const { currentMode, toggleMode } = useTheme()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'admin-signup' })
  }
}
</script>

<template>
  <div class="privacy-page">
    <header class="privacy-header">
      <div class="privacy-header-content">
        <router-link to="/admin" class="brand-link">
          <img :src="currentMode === 'dark' ? logoNegative : logoPositive" alt="Repítela" class="privacy-logo" />
        </router-link>
        <div class="header-actions">
          <button class="theme-toggle" :aria-label="`Cambiar a tema ${currentMode === 'dark' ? 'claro' : 'oscuro'}`" @click="toggleMode">
            {{ currentMode === 'dark' ? '☀' : '☾' }}
          </button>
        </div>
      </div>
    </header>

    <main class="container privacy-container">
      <div class="privacy-card card">
        <button type="button" class="back-link" @click="goBack">
          &larr; Volver
        </button>

        <h1 class="policy-title">Política de Tratamiento de Datos Personales</h1>
        <p class="policy-subtitle">
          En cumplimiento de la <strong>Ley 1581 de 2012</strong>, el <strong>Decreto 1377 de 2013</strong> y el régimen de Habeas Data de la República de Colombia.
        </p>
        <p class="policy-date"><strong>Última actualización:</strong> Agosto de 2026</p>

        <hr class="policy-divider" />

        <section class="policy-section">
          <h2>1. Identificación del Responsable del Tratamiento</h2>
          <p>
            <strong>Repítela</strong> es una plataforma tecnológica de entretenimiento musical interactivo para bares, discotecas, gastrobares y eventos en Colombia. Para los efectos legales correspondientes, Repítela actúa como <em>Responsable del Tratamiento</em> de los datos personales suministrados por sus usuarios.
          </p>
          <div class="contact-box">
            <p><strong>Canal de atención para solicitudes de Habeas Data:</strong></p>
            <p>Correo electrónico: <a href="mailto:privacidad@repitela.com">privacidad@repitela.com</a></p>
          </div>
        </section>

        <section class="policy-section">
          <h2>2. Datos Personales que Recolectamos</h2>
          <p>Repítela recolecta exclusivamente los datos necesarios y pertinentes para el funcionamiento de la plataforma:</p>

          <h3>A. Administradores y Representantes de Bares</h3>
          <ul>
            <li><strong>Datos de contacto e identidad:</strong> Nombre completo, número de teléfono móvil y correo electrónico corporativo o personal.</li>
            <li><strong>Datos del establecimiento:</strong> Cargo o rol en el bar (dueño o administrador), nombre comercial del establecimiento, dirección física y temática del local.</li>
            <li><strong>Datos de seguridad y acceso:</strong> Contraseña cifrada con hash criptográfico unidireccional (bcrypt), fecha y hora de aceptación de términos y registros de inicio de sesión.</li>
          </ul>

          <h3>B. Clientes y Asistentes al Bar</h3>
          <ul>
            <li><strong>Número de teléfono móvil:</strong> Para habilitar la sesión de pedidos de canciones desde la mesa sin requerir instalación de aplicaciones.</li>
            <li><strong>Nombre o alias (opcional):</strong> Para identificar quién solicitó el tema en la pantalla del bar si el usuario decide suministrarlo.</li>
            <li><strong>Historial musical:</strong> Canciones buscadas y solicitadas en la cola del establecimiento.</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>3. Finalidades del Tratamiento</h2>
          <p>Los datos personales recolectados son tratados bajo las siguientes finalidades legítimas:</p>
          <ul>
            <li><strong>Operación de la rockola digital:</strong> Permitir que los clientes encolen canciones de YouTube y que el personal del bar gestione la reproducción en tiempo real.</li>
            <li><strong>Administración de cuentas y suscripciones:</strong> Gestionar el alta del bar, el período de prueba gratuita (trial de 15 días), la activación de planes comerciales y la atención de soporte técnico.</li>
            <li><strong>Comunicaciones transaccionales y de seguridad:</strong> Envío de correos de verificación de cuenta, restablecimiento de contraseñas y notificaciones críticas del servicio.</li>
            <li><strong>Moderación y prevención de abusos:</strong> Aplicar límites de canciones por mesa y evitar conductas contrarias a la convivencia en el bar.</li>
            <li><strong>Estadísticas agregadas:</strong> Elaborar análisis estadísticos disociados sobre tendencias musicales para mejorar el servicio.</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>4. Compromiso de No Venta ni Cesión de Datos</h2>
          <p>
            <strong>Repítela no vende, no alquila, no cede ni comercializa datos personales a terceros.</strong>
          </p>
          <p>
            La información únicamente se transfiere a proveedores de infraestructura tecnológica estrictamente indispensables para la prestación del servicio (por ejemplo, servidores de alojamiento seguro y pasarelas de correo transaccional como Brevo), quienes obran como Encargados del Tratamiento bajo estrictas obligaciones de confidencialidad y seguridad.
          </p>
        </section>

        <section class="policy-section">
          <h2>5. Tiempo de Conservación de los Datos</h2>
          <p>
            Los datos personales se conservarán durante el tiempo que la cuenta del bar permanezca activa y durante los plazos legalmente exigibles para atender obligaciones contractuales, tributarias o legales aplicables en Colombia. Los datos de clientes de bar se suprimen o disocian una vez cumplida la finalidad de la sesión o a solicitud del titular.
          </p>
        </section>

        <section class="policy-section">
          <h2>6. Derechos de los Titulares (Habeas Data)</h2>
          <p>De conformidad con el artículo 8 de la Ley 1581 de 2012, usted tiene derecho a:</p>
          <ul>
            <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente a datos parciales, inexactos, incompletos o fraccionados.</li>
            <li><strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento de sus datos.</li>
            <li><strong>Ser informado</strong> sobre el uso que se ha dado a sus datos personales.</li>
            <li><strong>Revocar la autorización y/o solicitar la supresión</strong> de sus datos cuando no exista un deber legal o contractual de permanecer en la base de datos.</li>
            <li><strong>Acceder en forma gratuita</strong> a sus datos personales objeto de tratamiento.</li>
            <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>7. Procedimiento para Ejercer sus Derechos</h2>
          <p>
            Para realizar consultas, actualizaciones, rectificaciones o solicitar la supresión de sus datos personales, envíe un correo electrónico a:
          </p>
          <div class="contact-box">
            <p><strong>Correo electrónico:</strong> <a href="mailto:privacidad@repitela.com">privacidad@repitela.com</a></p>
            <p><strong>Asunto:</strong> Solicitud Habeas Data - Repítela</p>
          </div>
          <p>
            Indique su nombre completo, número de documento de identificación, descripción clara de su solicitud y datos de contacto para remitirle respuesta.
          </p>
          <ul>
            <li><strong>Consultas:</strong> Serán atendidas en un plazo máximo de diez (10) días hábiles.</li>
            <li><strong>Reclamos y solicitudes de supresión:</strong> Serán atendidos en un plazo máximo de quince (15) días hábiles.</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>8. Registro Nacional de Bases de Datos (RNBD)</h2>
          <p>
            De conformidad con el Decreto 886 de 2014, el Decreto 090 de 2018 y los lineamientos de la Superintendencia de Industria y Comercio (SIC), Repítela no se encuentra obligada a registrar sus bases de datos ante el Registro Nacional de Bases de Datos (RNBD) por encontrarse por debajo del umbral de activos totales (100.000 UVT) y volumen de titulares previsto por la ley. No obstante, Repítela implementa rigurosamente todos los principios de protección, seguridad y confidencialidad exigidos por la Ley 1581 de 2012.
          </p>
        </section>

        <section class="policy-section">
          <h2>9. Seguridad de la Información</h2>
          <p>
            Repítela implementa medidas técnicas, administrativas y de seguridad informática (incluyendo conexiones cifradas HTTPS, hash seguro de contraseñas y control de accesos por roles) para impedir la adulteración, pérdida, consulta o acceso no autorizado a los datos almacenados.
          </p>
        </section>

        <section class="policy-section">
          <h2>10. Vigencia y Actualizaciones</h2>
          <p>
            Esta política rige a partir de agosto de 2026. Cualquier modificación sustancial será informada a través de la plataforma y publicada oportunamente en este mismo enlace.
          </p>
        </section>

        <div class="footer-actions">
          <button type="button" class="btn btn-primary back-btn" @click="goBack">
            Entendido, volver
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.privacy-page {
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--bg);
  color: var(--text);
  padding-bottom: 48px;
}

.privacy-header {
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 20;
}

.privacy-header-content {
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.privacy-logo {
  height: 28px;
  width: auto;
  display: block;
}

.privacy-container {
  max-width: 860px;
  margin: 32px auto 0;
  padding: 0 16px;
}

.privacy-card {
  padding: 40px 36px;
  border-radius: var(--radius-lg, 16px);
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px var(--shadow);
}

.back-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 20px;
  display: inline-block;
}

.back-link:hover {
  text-decoration: underline;
}

.policy-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 12px;
  color: var(--text);
}

.policy-subtitle {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.policy-date {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 24px;
}

.policy-divider {
  border: none;
  height: 1px;
  background-color: var(--border);
  margin: 24px 0 32px;
}

.policy-section {
  margin-bottom: 32px;
}

.policy-section h2 {
  font-size: 19px;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text);
}

.policy-section h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 16px 0 8px;
  color: var(--text);
}

.policy-section p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 12px;
}

.policy-section ul {
  padding-left: 20px;
  margin-bottom: 16px;
}

.policy-section li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 8px;
}

.contact-box {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  padding: 16px 20px;
  margin: 16px 0;
}

.contact-box p {
  margin-bottom: 4px;
  font-size: 14px;
}

.contact-box p:last-child {
  margin-bottom: 0;
}

.contact-box a {
  color: var(--primary);
  font-weight: 600;
}

.footer-actions {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.back-btn {
  max-width: 220px;
}

/* =========================================
   BREAKPOINT 480px (Mobile)
   ========================================= */
@media (max-width: 480px) {
  .privacy-card {
    padding: 24px 16px;
    border-radius: var(--radius, 12px);
  }
  .policy-title {
    font-size: 22px;
  }
  .back-btn {
    max-width: 100%;
    width: 100%;
  }
}
</style>
