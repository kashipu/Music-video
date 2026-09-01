import BillingActions from './BillingActions.vue'

export default {
  title: 'Components/Billing/Actions',
  component: BillingActions,
}

const baseProps = {
  referenceStartLabel: '9 de ago de 2026',
  referenceStart: new Date('2026-08-09T00:00:00'),
  periodEnd: '2026-09-13',
  busy: false,
  saveMsg: '',
  errorMsg: '',
}

export const RegistrarPago = {
  args: {
    ...baseProps,
    initialTab: 'payment',
  },
}

export const DarPrueba = {
  args: {
    ...baseProps,
    initialTab: 'trial',
  },
}

export const Corregir = {
  args: {
    ...baseProps,
    initialTab: 'adjust',
  },
}

export const Guardando = {
  args: {
    ...baseProps,
    busy: true,
  },
}

export const ConExito = {
  args: {
    ...baseProps,
    saveMsg: 'Pago registrado con éxito',
  },
}

export const ConError = {
  args: {
    ...baseProps,
    errorMsg: 'No se pudo registrar el pago: error de conexión',
  },
}
