export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export class LicenseAccessError extends HttpError {
  constructor() { super(403, 'Licença ausente, vencida ou revogada. Ative o teste ou solicite a liberação após o Pix.'); }
}

export class CampaignStoppedError extends Error {}
export class UncertainDeliveryError extends Error {
  constructor() { super('Não foi possível confirmar a entrega. Confira o grupo antes de reenviar. A campanha foi pausada para revisão.'); }
}
