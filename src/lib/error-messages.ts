export const ERROR_MESSAGES: Record<string, string> = {
  // ============ AUTH ============
  'A user with this email address has already been registered': 
    'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.',
  
  'Invalid login credentials': 
    'E-mail ou senha incorretos. Verifique e tente novamente.',
  
  'Email not confirmed': 
    'Você precisa confirmar seu e-mail antes de fazer login.',
  
  'User not found': 
    'Usuário não encontrado.',
  
  'Password should be at least 6 characters': 
    'A senha deve ter pelo menos 6 caracteres.',
  
  'Unable to validate email address: invalid format': 
    'Formato de e-mail inválido.',
  
  'Signups not allowed for this instance': 
    'Cadastros estão temporariamente desabilitados.',
  
  'Email rate limit exceeded': 
    'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  
  // ============ DATABASE ============
  'Produto não encontrado':
    'Um ou mais itens do seu carrinho não estão mais disponíveis. Atualize o cardápio e tente novamente.',

  'Produto inválido ou indisponível':
    'Um ou mais itens do seu carrinho não estão mais disponíveis. Atualize o cardápio e tente novamente.',

  'duplicate key value violates unique constraint':
    'Este registro já existe no sistema.',
  
  'violates foreign key constraint': 
    'Não é possível realizar esta ação porque há dados relacionados.',
  
  'violates check constraint': 
    'Os dados informados não atendem aos requisitos do sistema.',
  
  'permission denied': 
    'Você não tem permissão para realizar esta ação.',
  
  'new row violates row-level security policy': 
    'Você não tem permissão para criar este registro.',
  
  // ============ EDGE FUNCTIONS ============
  'Edge Function returned a non-2xx status code': 
    'Erro ao processar sua solicitação. Tente novamente em alguns instantes.',
  
  'Failed to fetch': 
    'Erro de conexão. Verifique sua internet e tente novamente.',
  
  // ============ NETWORK ============
  'Network request failed': 
    'Falha de conexão com o servidor.',
  
  'Request timeout': 
    'A solicitação demorou muito. Tente novamente.',
  
  // ============ GENÉRICOS ============
  'Internal Server Error': 
    'Erro interno do servidor. Nossa equipe foi notificada.',
  
  'Bad Request': 
    'Dados inválidos enviados ao servidor.',
  
  'Unauthorized': 
    'Sessão expirada. Faça login novamente.',
  
  'Forbidden': 
    'Você não tem autorização para esta ação.',
  
  'Not Found': 
    'Recurso não encontrado.',
  
  // ============ ADMIN SPECIFIC ============
  'Autenticação necessária.':
    'Você precisa estar autenticado para realizar esta ação.',
  
  'Token inválido.':
    'Sua sessão expirou. Faça login novamente.',
  
  'Acesso negado. Apenas usuários master.':
    'Apenas o administrador master pode criar novos administradores.',
  
  'Email e senha são obrigatórios.':
    'Preencha todos os campos obrigatórios.',
  
  'Senha deve ter no mínimo 6 caracteres.':
    'A senha deve ter no mínimo 6 caracteres.',
  
  'Erro ao atualizar senha do usuário existente':
    'Erro ao atualizar usuário. Tente novamente.',
  
  'Erro ao atribuir papel':
    'Erro ao atribuir permissões. Tente novamente.',
  
  'Erro ao criar restaurante':
    'Erro ao criar restaurante. Tente novamente.',
};

/**
 * Traduz uma mensagem de erro para português.
 * Faz busca exata primeiro, depois busca por palavras-chave.
 */
export function translateError(error: unknown): string {
  if (!error) return 'Erro desconhecido. Tente novamente.';
  
  // Extrair mensagem do erro
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && 'message' in error) {
    message = String((error as any).message);
  } else if (typeof error === 'object' && 'error' in error) {
    message = String((error as any).error);
  } else {
    return 'Erro desconhecido. Tente novamente.';
  }
  
  // Busca exata
  if (ERROR_MESSAGES[message]) {
    return ERROR_MESSAGES[message];
  }
  
  // Busca por chave que contenha parte da mensagem
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Se não achou tradução, retorna mensagem genérica amigável
  console.warn('[i18n] Erro sem tradução:', message);
  return 'Algo deu errado. Tente novamente ou entre em contato com o suporte.';
}
