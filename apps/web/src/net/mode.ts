/**
 * Mode réseau choisi à la compilation :
 * - « server » (défaut) : serveur de jeu Node (REST + Socket.IO) ;
 * - « supabase » : site statique, simulation dans le navigateur de l'hôte,
 *   comptes/sauvegardes/temps réel via Supabase (`vite build --mode supabase`).
 */
export const WEB_MODE = import.meta.env.VITE_BACKEND === 'supabase';
