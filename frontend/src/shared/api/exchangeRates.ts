import { buildQuery, fetchApi } from './http';

export interface ExchangeRatePair {
  base: string;
  quote: string;
  rate: number;
  effective_date: string | null;
}

export interface ExchangeRatesList {
  base: string;
  effective_date: string | null;
  rates: ExchangeRatePair[];
}

export const exchangeRatesApi = {
  getExchangeRates: (base = 'USD') =>
    fetchApi<ExchangeRatesList>(`/exchange-rates${buildQuery({ base })}`),

  getExchangeRate: (base: string, target: string) =>
    fetchApi<ExchangeRatePair>(`/exchange-rates/${base}/${target}`),
};
