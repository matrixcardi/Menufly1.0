import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function CheckoutCanceled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full text-center border-2">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4">
              <Logo className="h-10 w-auto" />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <XCircle className="w-10 h-10 text-muted-foreground" />
            </motion.div>
            <CardTitle className="text-2xl">
              Pagamento Cancelado
            </CardTitle>
            <CardDescription className="text-base">
              Sua assinatura não foi processada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Não se preocupe, você pode tentar novamente quando quiser. 
              Se teve algum problema ou dúvida, nossa equipe está pronta para ajudar.
            </p>
            
            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Voltar para o Início
              </Button>
              
              <Button 
                size="lg" 
                variant="outline"
                className="w-full"
                onClick={() => navigate("/#pricing")}
              >
                Tentar Novamente
              </Button>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Precisa de ajuda?</p>
              <Button variant="ghost" size="sm" className="text-primary">
                <MessageSquare className="mr-2 w-4 h-4" />
                Falar com Suporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
