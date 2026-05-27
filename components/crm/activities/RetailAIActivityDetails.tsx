"use client";
import { useState, useEffect } from "react";
import { 
  Bot, 
  Phone, 
  Calendar, 
  Clock, 
  FileText,
  CheckCircle2, 
  XCircle, 
  Smile, 
  Frown, 
  Meh,
  ExternalLink,
  PlayCircle,
  MessageSquare,
  Activity,
  Zap,
  DollarSign,
  FileCode,
  User,
  Mail,
  MapPin
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActivityWithLinks } from "@/actions/crm/activities/get-activities-by-entity";

interface Props {
  activity: ActivityWithLinks;
}

export function RetailAIActivityDetails({ activity }: Props) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const metadata = (activity.aiMetadata as any) || {};
  const payload = (activity.retailAIPayload as any) || {};
  const customer = payload?.call?.call_analysis?.custom_analysis_data || {};
  
  // Prioritize new fields over payload extraction
  const customerName = activity.customer_name || customer.customer_name || 'Unknown Customer';
  const customerEmail = activity.email || customer.customer_email || 'No email provided';
  const customerPhone = activity.phone_number || customer.customer_phone || 'No phone';
  const callSummary = activity.call_summary || activity.aiGeneratedSummary || activity.outcome || "No summary available.";
  const sentiment = activity.user_sentiment || activity.sentiment;
  const isSuccessful = activity.call_successful === 'accepted' || activity.call_successful === 'yes' || activity.callSuccessful;
  const callCost = activity.combined_cost ? Number(activity.combined_cost) : (metadata.cost || 0);
  const duration = activity.call_duration || activity.duration;
  
  // Additional extracted info
  const insuranceInterest = activity.insurance_interest || customer.insurance_interest;
  const location = [activity.state, activity.location].filter(Boolean).join(", ") || customer.location;
  const smokerStatus = activity.smoker_status || customer.smoker_status;
  const consultationType = activity.consultation_type || customer.consultation_type;
  const callOutcome = activity.call_outcome || customer.outcome;
  const timezone = activity.timezone || customer.timezone;

  const SentimentIcon = sentiment === 'Positive' ? Smile : 
                        sentiment === 'Negative' ? Frown : Meh;
  
  const sentimentColor = sentiment === 'Positive' ? 'text-green-500' : 
                         sentiment === 'Negative' ? 'text-red-500' : 'text-blue-500';

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{activity.title}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {mounted ? new Date(activity.date).toLocaleString() : ''}
              <span className="mx-1">•</span>
              <Clock className="h-3.5 w-3.5" />
              {duration} mins
              {activity.call_id && (
                <>
                  <span className="mx-1">•</span>
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">ID: {activity.call_id}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
            {activity.aiSource || 'Retell AI'}
          </Badge>
          <Badge variant={isSuccessful ? "default" : "destructive"}>
            {activity.call_successful || (isSuccessful ? "Successful Outcome" : "Unsuccessful")}
          </Badge>
          {sentiment && (
            <Badge variant="outline" className={cn("gap-1.5", sentimentColor)}>
              <SentimentIcon className="h-3.5 w-3.5" />
              {sentiment}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Main Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Summary Card */}
          <Card className="rounded-2xl shadow-sm border-blue-100 bg-blue-50/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Call Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-700">
                {callSummary}
              </p>
              
              {activity.recordingUrl && (
                <div className="mt-6 p-4 rounded-xl bg-slate-900 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Call Recording</div>
                    <a href={activity.recordingUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">Download Audio</a>
                  </div>
                  <audio src={activity.recordingUrl} controls className="w-full h-10 invert brightness-100" />
                </div>
              )}

              {activity.appointment_time && (
                <div className="mt-4 p-3 rounded-xl bg-white/50 border border-blue-100 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Scheduled Appointment</div>
                    <div className="text-sm font-semibold text-slate-800">
                      {mounted ? new Date(activity.appointment_time).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-muted/50 p-1">
              <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="insights" className="rounded-lg">Insights</TabsTrigger>
              <TabsTrigger value="transcript" className="rounded-lg">Transcript</TabsTrigger>
              <TabsTrigger value="technical" className="rounded-lg">Technical</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duration</div>
                  <div className="text-sm font-semibold">{duration}s</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Cost</div>
                  <div className="text-sm font-semibold text-green-600">${callCost.toFixed(4)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Confidence</div>
                  <div className="text-sm font-semibold">{Number(activity.aiConfidenceScore || 0).toFixed(0)}%</div>
                </div>
                {smokerStatus && (
                  <div className="p-3 rounded-xl bg-slate-50 border">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Smoker</div>
                    <div className="text-sm font-semibold">{smokerStatus}</div>
                  </div>
                )}
                {insuranceInterest && (
                  <div className="p-3 rounded-xl bg-slate-50 border">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Plan Interest</div>
                    <div className="text-sm font-semibold">{insuranceInterest}</div>
                  </div>
                )}
                {callOutcome && (
                  <div className="p-3 rounded-xl bg-slate-50 border">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Outcome</div>
                    <div className="text-sm font-semibold truncate">{callOutcome}</div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="rounded-2xl border-purple-100 bg-purple-50/20">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                      Key Takeaways
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-sm text-slate-700">{activity.aiInsights || "No specific insights generated."}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-orange-100 bg-orange-50/20">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                      Customer Intent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Badge variant="outline" className="bg-white/50 border-orange-200 text-orange-700 capitalize">
                      {customer.customer_intent || "Not specified"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-2xl border bg-slate-50/50 p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Conversion Probability
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Likelihood of conversion</span>
                    <span>{Number(activity.aiConfidenceScore || 0).toFixed(0)}%</span>
                  </div>
                  <Progress value={Number(activity.aiConfidenceScore || 0)} className="h-2 bg-slate-200" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="mt-4">
              <div className="rounded-2xl border bg-slate-50/30 overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto p-6 space-y-6 bg-white">
                  {Array.isArray(activity.transcript) ? (
                    activity.transcript.map((msg: any, i: number) => (
                      <div key={i} className={cn(
                        "flex flex-col gap-1.5 max-w-[85%]",
                        msg.role === 'agent' || msg.role === 'assistant' ? "mr-auto" : "ml-auto items-end"
                      )}>
                        <div className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-1",
                          msg.role === 'agent' || msg.role === 'assistant' ? "text-blue-600" : "text-slate-500"
                        )}>
                          {msg.role === 'agent' || msg.role === 'assistant' ? "AI Agent" : "Customer"}
                        </div>
                        <div className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm shadow-sm border",
                          msg.role === 'agent' || msg.role === 'assistant' 
                            ? "bg-blue-50 border-blue-100 text-slate-800 rounded-tl-none" 
                            : "bg-slate-50 border-slate-200 text-slate-800 rounded-tr-none"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  ) : (
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono p-4 bg-slate-50 rounded-xl border">
                      {typeof activity.transcript === 'string' ? activity.transcript : JSON.stringify(activity.transcript, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="rounded-xl border shadow-none bg-muted/20">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5" />
                      Latency (ms)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-lg p-2 border">
                        <div className="text-[10px] text-muted-foreground uppercase">p50</div>
                        <div className="text-sm font-bold">{metadata.latency?.p50 || '-'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <div className="text-[10px] text-muted-foreground uppercase">p90</div>
                        <div className="text-sm font-bold">{metadata.latency?.p90 || '-'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <div className="text-[10px] text-muted-foreground uppercase">p99</div>
                        <div className="text-sm font-bold">{metadata.latency?.p99 || '-'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl border shadow-none bg-muted/20">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      Cost Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div className="text-xs font-medium">Total Call Cost</div>
                      <div className="text-sm font-bold text-green-600">
                        ${callCost.toFixed(4)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border bg-slate-900 p-4">
                 <div className="flex items-center justify-between mb-2">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                     <FileCode className="h-3.5 w-3.5" />
                     Raw Payload
                   </h4>
                   <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                     onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                     }}
                   >
                     Copy JSON
                   </Button>
                 </div>
                 <pre className="text-[10px] text-blue-300 font-mono overflow-auto max-h-[200px] p-2 bg-slate-800/50 rounded-lg">
                   {JSON.stringify(payload, null, 2)}
                 </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card className="rounded-2xl shadow-sm overflow-hidden border-slate-200">
             <div className="bg-slate-100 px-4 py-3 border-b">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                 <User className="h-3.5 w-3.5" />
                 Customer Details
               </h4>
             </div>
             <CardContent className="p-4 space-y-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">
                   {(customerName[0] || 'C').toUpperCase()}
                 </div>
                 <div className="min-w-0">
                   <div className="font-bold truncate">{customerName}</div>
                   <div className="text-xs text-muted-foreground truncate">{customerEmail}</div>
                 </div>
               </div>

               <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {customerPhone}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {customerEmail}
                  </div>
                  {location && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {location} {timezone ? `(${timezone})` : ''}
                    </div>
                  )}
               </div>

               <div className="pt-4 border-t space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Call Analysis</h4>
                  
                  {insuranceInterest && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">Interest</div>
                      <div className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">{insuranceInterest}</div>
                    </div>
                  )}

                  {consultationType && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">Consultation</div>
                      <div className="text-xs font-semibold text-slate-700">{consultationType}</div>
                    </div>
                  )}

                  {smokerStatus && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">Smoker Status</div>
                      <div className="text-xs font-semibold text-slate-700">{smokerStatus}</div>
                    </div>
                  )}

                  {callOutcome && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">Outcome</div>
                      <div className="text-xs font-semibold text-slate-700">{callOutcome}</div>
                    </div>
                  )}
               </div>

               {activity.links.length > 0 && (
                 <div className="pt-2 border-t mt-2">
                    <Button variant="outline" size="sm" className="w-full justify-start rounded-xl h-9 text-xs gap-2"
                      onClick={() => {
                        const contactLink = activity.links.find(l => l.entityType === 'contact');
                        if (contactLink) window.location.href = `/[locale]/crm/contacts/${contactLink.entityId}`;
                      }}
                    >
                      <User className="h-3.5 w-3.5" />
                      Go to CRM Contact
                    </Button>
                 </div>
               )}
             </CardContent>
          </Card>

          {/* Media Links */}
          <Card className="rounded-2xl shadow-sm overflow-hidden border-slate-200">
             <div className="bg-slate-100 px-4 py-3 border-b">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                 <PlayCircle className="h-3.5 w-3.5" />
                 Media & Logs
               </h4>
             </div>
             <CardContent className="p-4 space-y-3">
               {activity.recordingUrl ? (
                 <Button className="w-full justify-start rounded-xl gap-2 h-10" 
                   onClick={() => window.open(activity.recordingUrl!, '_blank')}>
                   <PlayCircle className="h-4 w-4" />
                   Play Audio Recording
                 </Button>
               ) : (
                 <div className="text-xs text-muted-foreground text-center py-2 bg-slate-50 rounded-lg border border-dashed">
                   Recording not available
                 </div>
               )}

               {activity.publicLogUrl && (
                 <Button variant="outline" className="w-full justify-start rounded-xl gap-2 h-10"
                   onClick={() => window.open(activity.publicLogUrl!, '_blank')}>
                   <ExternalLink className="h-4 w-4" />
                   View Detailed Logs
                 </Button>
               )}
             </CardContent>
          </Card>

          {/* Status Tracker */}
          <div className="rounded-2xl border p-4 bg-muted/10 space-y-4">
             <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
               Process Tracking
             </h4>
             <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">Webhook Received</div>
                    <div className="text-muted-foreground">Processed successfully</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px]">
                    AI
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">AI Analysis</div>
                    <div className="text-muted-foreground">Confidence: {Number(activity.aiConfidenceScore || 0).toFixed(0)}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-white",
                    activity.aiStatus === 'accepted' ? "bg-green-500" : "bg-amber-500"
                  )}>
                    {activity.aiStatus === 'accepted' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">CRM Status</div>
                    <div className="text-muted-foreground capitalize">{activity.aiStatus || 'Pending Review'}</div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
