/**
 * Maps database and API error messages to user-friendly messages.
 * Prevents leaking internal system details to users.
 */
export function getUserFriendlyError(error: unknown): string {
  const message = 
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: string }).message).toLowerCase()
      : '';

  // Row Level Security errors
  if (message.includes('row-level security') || message.includes('rls')) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  // Foreign key constraint errors
  if (message.includes('foreign key constraint') || message.includes('violates foreign key')) {
    return 'Este item está vinculado a outros registros e não pode ser removido.';
  }

  // Unique constraint errors
  if (message.includes('unique constraint') || message.includes('duplicate key')) {
    return 'Já existe um registro com estes dados.';
  }

  // Not null constraint errors
  if (message.includes('not null constraint') || message.includes('null value in column')) {
    return 'Preencha todos os campos obrigatórios.';
  }

  // Authentication errors
  if (message.includes('jwt') || message.includes('unauthorized') || message.includes('not authenticated')) {
    return 'Sua sessão expirou. Por favor, faça login novamente.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }

  // Generic fallback
  return 'Ocorreu um erro. Tente novamente ou contate o suporte.';
}
