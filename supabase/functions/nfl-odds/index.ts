import { serve } from '../_shared/http.ts';
import { currentOdds } from '../_shared/odds.ts';
serve(() => currentOdds());
