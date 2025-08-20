import { ReasoningStyle } from './types.ts';

export class ReasoningSelector {
  static select(messageText: string, toolsAvailable: string[], allowed?: ReasoningStyle[], bias?: ReasoningStyle): ReasoningStyle {
    const pool: ReasoningStyle[] = (allowed && allowed.length ? allowed : ['inductive','abductive','deductive']);
    if (bias && pool.includes(bias)) return bias;
    
    // Enhanced deductive detection
    if (/deductive|prove|must|necessarily|if\s+then|logical|conclude|therefore|thus|hence|given.*then/i.test(messageText) && pool.includes('deductive')) return 'deductive';
    
    // Enhanced abductive detection  
    if (/why|because|cause|leads to|hypothesis|explain|best explanation|likely/i.test(messageText) && pool.includes('abductive')) return 'abductive';
    
    // Enhanced inductive detection
    if (/inductive|pattern|examples?|generalize|trend|observe|similar|cases/i.test(messageText) && pool.includes('inductive')) return 'inductive';
    
    // Tool hint → prefer abductive (hypothesis & test)
    if (toolsAvailable.length && pool.includes('abductive')) return 'abductive';
    return pool[0];
  }
}


