import axios from 'axios';

export const api = axios.create({ baseURL: '/api/v1', withCredentials: true, withXSRFToken: true });

// Marca del negocio: se configura por entorno (VITE_APP_NAME, VITE_LOGO_URL, VITE_LOGO_MARK_URL).
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || 'Calle Auto Center';
export const LOGO_URL: string = import.meta.env.VITE_LOGO_URL || '/favicon.ico';
export const LOGO_MARK_URL: string = import.meta.env.VITE_LOGO_MARK_URL || LOGO_URL;
