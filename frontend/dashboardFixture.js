// Local-only fixture for /dashboard-v2-fixture. Not loaded by the production dashboard document.
/* global authSession:writable, authUser:writable, applyDashboardLanguage, getDashboardLanguage, localizeDashboardCopy, createEmptyActionQueue, createEmptyOperatorWorkspace, createEmptyConnectedAppsState, createEmptyAnalyticsSummary, setStatus, renderReadyState, createEmptyFrontDeskTraining */
(function initDashboardFixture(window) {
  function renderLocalDashboardV2Fixture() {
    authSession = { access_token: "local-dashboard-v2-fixture" };
    authUser = { id: "local-v2-owner", email: "local.owner@example.test" };
    if (!authSession.access_token) {
      setStatus("Local dashboard fixture auth unavailable.");
      return;
    }
    applyDashboardLanguage(getDashboardLanguage());

    const now = new Date().toISOString();
    const fixtureText = (english, hungarian) => localizeDashboardCopy(english, hungarian);
    const agent = {
      id: "local-agent-1",
      name: fixtureText("Local fixture workspace", "Helyi demó munkaterület"),
      assistantName: fixtureText("Local front desk", "Helyi weboldali asszisztens"),
      ownerName: fixtureText("Local Owner", "Helyi tulajdonos"),
      ownerEmail: "local.owner@example.test",
      businessName: fixtureText("Local Services", "Helyi Szolgáltatások"),
      websiteUrl: "https://local.example.test",
      publicAgentKey: "local-public-agent",
      installId: "local-install-1",
      welcomeMessage: fixtureText(
        "Hi, I can help with services, booking, quotes, and support.",
        "Szia, segítek szolgáltatásokkal, foglalással, ajánlatkéréssel és ügyféltámogatással."
      ),
      buttonLabel: fixtureText("Ask a question", "Kérdés feltevése"),
      tone: "professional",
      accessStatus: "active",
      knowledge: {
        state: "ready",
        pageCount: 7,
      },
      allowedDomains: ["local.example.test"],
      installStatus: {
        state: "seen_recently",
        label: fixtureText("Live install detected", "Élő telepítés észlelve"),
        host: "local.example.test",
        pageUrl: "https://local.example.test/",
        lastSeenAt: now,
        lastSeenUrl: "https://local.example.test/",
        lastVerifiedAt: now,
        verificationStatus: "ok",
        verificationTargetUrl: "https://local.example.test/",
        verificationOrigin: "server",
        verificationDetails: {},
        allowedDomains: ["local.example.test"],
        installId: "local-install-1",
        installedAt: now,
      },
    };
    const messages = [
      {
        id: "fixture-message-1",
        role: "user",
        content: fixtureText("Can I book a consultation this week?", "Tudok konzultációt foglalni erre a hétre?"),
        createdAt: now,
        source: "widget",
      },
      {
        id: "fixture-message-2",
        role: "assistant",
        content: fixtureText(
          "Yes. Share your preferred day and contact details, and the team can confirm the next step.",
          "Igen. Add meg a számodra megfelelő napot és az elérhetőségeidet, és a csapat megerősíti a következő lépést."
        ),
        createdAt: now,
        source: "widget",
      },
      {
        id: "fixture-message-3",
        role: "user",
        content: fixtureText("What affects the quote?", "Mi befolyásolja az ajánlatot?"),
        createdAt: now,
        source: "page",
      },
    ];
    const actionQueue = {
      ...createEmptyActionQueue(),
      items: [
        {
          id: "fixture-action-1",
          key: "fixture-action-1",
          type: "pricing",
          status: "new",
          safeSummary: fixtureText(
            "Customer asked what affects quote timing and price.",
            "Az ügyfél azt kérdezte, mi befolyásolja az ajánlat időzítését és árát."
          ),
          recommendedNextAction: fixtureText(
            "Review pricing guidance and confirm the follow-up path.",
            "Nézd át az árazási útmutatást, és erősítsd meg az utánkövetési utat."
          ),
        },
      ],
      summary: {
        ...createEmptyActionQueue().summary,
        total: 1,
        new: 1,
        attentionNeeded: 1,
      },
      conversionSummary: {
        ...createEmptyActionQueue().conversionSummary,
        highIntentConversations: 2,
        contactsCaptured: 1,
        captureRate: 50,
        assistedConversions: 1,
        bookingDirectHandoffs: 1,
      },
      outcomeSummary: {
        ...createEmptyActionQueue().outcomeSummary,
        total: 1,
        assistedConversions: 1,
        bookingStarted: 1,
      },
      analyticsSummary: {
        ...createEmptyAnalyticsSummary(),
        conversationCount: 2,
        uniqueVisitorCount: 2,
        totalMessages: 3,
        visitorQuestions: 2,
        highIntentSignals: 2,
        contactsCaptured: 1,
        assistedOutcomes: 1,
        weakAnswerCount: 1,
        attentionNeeded: 1,
        customerQuestionSummaries: [
          { summary: fixtureText("Booking availability", "Foglalási elérhetőség"), count: 1 },
          { summary: fixtureText("Quote details", "Ajánlatkérési részletek"), count: 1 },
        ],
        weakAnswerExamples: [
          fixtureText(
            "Quote guidance needs clearer inputs and timing.",
            "Az ajánlatkérési útmutatáshoz világosabb bemenetek és időzítés kell."
          ),
        ],
        usageTrend: {
          copy: fixtureText(
            "Fixture activity uses the same shape as live dashboard data.",
            "A demó aktivitás ugyanazt az adatstruktúrát használja, mint az élő irányítópult adatai."
          ),
        },
        recentActivity: {
          lastActivityAt: now,
        },
      },
      ownerAnalyticsDashboard: {
        ok: true,
        metrics: {
          totalConversations: 2,
          leadsCaptured: 1,
          conversionRate: 50,
        },
        assistantSource: {
          widget: {
            key: "widget",
            label: "Website Agent",
            conversationCount: 1,
            messageCount: 2,
            visitorQuestionCount: 1,
            leadsCaptured: 1,
          },
          page: {
            key: "page",
            label: "Front Desk page",
            conversationCount: 1,
            messageCount: 1,
            visitorQuestionCount: 1,
            leadsCaptured: 0,
          },
          web_call: {
            key: "web_call",
            label: "Web Call",
            conversationCount: 1,
            messageCount: 2,
            visitorQuestionCount: 1,
            leadsCaptured: 0,
          },
          unknown: {
            key: "unknown",
            label: "Legacy/unknown",
            conversationCount: 0,
            messageCount: 0,
            visitorQuestionCount: 0,
            leadsCaptured: 0,
          },
          totalConversations: 2,
          totalMessages: 3,
        },
        topVisitorQuestions: [
          { summary: fixtureText("Booking availability", "Foglalási elérhetőség"), count: 1 },
          { summary: fixtureText("Quote details", "Ajánlatkérési részletek"), count: 1 },
        ],
        missedQuestions: [
          {
            question: fixtureText(
              "Quote guidance needs clearer inputs and timing.",
              "Az ajánlatkérési útmutatáshoz világosabb bemenetek és időzítés kell."
            ),
          },
        ],
        customerSatisfaction: {
          totalFeedback: 1,
          helpful: 1,
          notHelpful: 0,
          negativeRate: 0,
          unhappyAnswers: [],
          weakTopics: [],
          recoveryActions: [],
          persistenceAvailable: true,
        },
        knowledgeImprovement: {
          title: fixtureText("Knowledge Improvement", "Tudásjavítás"),
          copy: fixtureText(
            "One pricing answer could use stronger guidance.",
            "Egy árazási válaszhoz erősebb útmutatás kell."
          ),
          total: 1,
          openCount: 1,
          approvedFixedCount: 0,
          dismissedCount: 0,
          guardrail: fixtureText(
            "Approved guidance must stay grounded in verified business facts.",
            "A jóváhagyott útmutatásnak ellenőrzött üzleti tényeken kell alapulnia."
          ),
          items: [
            {
              question: fixtureText("What affects the quote?", "Mi befolyásolja az ajánlatot?"),
              safeSummary: fixtureText(
                "Customer asked about quote factors.",
                "Az ügyfél ajánlatkérési tényezőkről kérdezett."
              ),
              reason: fixtureText("Pricing detail was thin.", "Az árazási részlet kevés volt."),
              status: "new",
            },
          ],
        },
        notifications: [],
        aiUsage: null,
        webCallHealth: {
          available: true,
          starts: 1,
          endedCalls: 1,
          averageDurationSeconds: 74,
          averageTurns: 2,
          contactFallbackSubmissions: 0,
          failureCategories: [
            { category: "speech_failed", label: fixtureText("Speech failed", "Beszédfelismerési hiba"), count: 1 },
          ],
          latestActivityAt: now,
        },
        webCallRecentCalls: {
          available: true,
          total: 1,
          calls: [
            {
              id: "fixture-web-call-1",
              actionKey: "web_call_review:fixture-web-call-1",
              webCallId: "fixture-web-call-1",
              sessionKey: "fixture-web-call-session",
              latestMessageId: "fixture-web-call-message-2",
              latestAssistantMessageId: "fixture-web-call-message-2",
              startedAt: now,
              latestActivityAt: now,
              durationSeconds: 74,
              turnCount: 2,
              contactFallbackOpened: true,
              contactFallbackSubmitted: false,
              hadFailures: true,
              failureCategories: ["speech_failed"],
              failureCategoryLabels: [fixtureText("Speech failed", "Beszédfelismerési hiba")],
              messages: [
                {
                  id: "fixture-web-call-message-1",
                  role: "user",
                  content: fixtureText("Can you walk me through quote timing?", "Végig tudsz vezetni az ajánlat időzítésén?"),
                  createdAt: now,
                },
                {
                  id: "fixture-web-call-message-2",
                  role: "assistant",
                  content: fixtureText(
                    "I can explain the usual inputs and collect details for the team.",
                    "El tudom magyarázni a szokásos bemeneteket, és összegyűjtöm a részleteket a csapatnak."
                  ),
                  createdAt: now,
                },
              ],
              latestQuestion: fixtureText("Can you walk me through quote timing?", "Végig tudsz vezetni az ajánlat időzítésén?"),
              latestAnswer: fixtureText(
                "I can explain the usual inputs and collect details for the team.",
                "El tudom magyarázni a szokásos bemeneteket, és összegyűjtöm a részleteket a csapatnak."
              ),
              review: {
                status: "new",
                followUpNeeded: false,
                followUpCompleted: false,
              },
              conversationSource: "web_call",
              action: {
                type: "conversation",
                label: fixtureText("Open related conversation", "Kapcsolódó beszélgetés megnyitása"),
                messageId: "fixture-web-call-message-2",
              },
            },
          ],
        },
      },
    };
    const operatorWorkspace = {
      ...createEmptyOperatorWorkspace(),
      enabled: true,
      featureEnabled: true,
      today: {
        ...createEmptyOperatorWorkspace().today,
        messagesToday: 3,
        contactsDealtToday: 1,
        needsAttentionCount: 1,
        assistedOutcomes: 1,
        leadsWithoutNextStep: 1,
      },
      contacts: {
        ...createEmptyOperatorWorkspace().contacts,
        list: [
          {
            id: "fixture-contact-1",
            customerRowKey: "fixture-contact-1",
            name: fixtureText("Local Customer", "Helyi ügyfél"),
            email: "customer@example.test",
            phone: "+1 555 0100",
            lifecycleState: "needs_review",
            source: "widget",
            latestMessageId: "fixture-message-1",
            latestSummary: fixtureText(
              "Asked to book a consultation this week.",
              "Konzultáció foglalását kérte erre a hétre."
            ),
            lastMessageAt: now,
            nextAction: {
              label: fixtureText("Confirm booking path", "Foglalási út megerősítése"),
            },
            counts: {
              leads: 1,
              inboxThreads: 0,
              calendarEvents: 0,
              followUps: 1,
              outcomes: 1,
            },
            chatMessages: [
              {
                role: "customer",
                label: fixtureText("Customer", "Ügyfél"),
                content: fixtureText("Can I book a consultation this week?", "Tudok konzultációt foglalni erre a hétre?"),
                createdAt: now,
              },
              {
                role: "vonza",
                label: "Vonza",
                content: fixtureText(
                  "Yes. Share your preferred day and contact details.",
                  "Igen. Add meg a számodra megfelelő napot és az elérhetőségeidet."
                ),
                createdAt: now,
              },
            ],
            timeline: [
              {
                at: now,
                label: fixtureText("Website Agent", "Website Agent"),
                summary: fixtureText(
                  "Booking question captured by the front desk.",
                  "A foglalási kérdést rögzítette a weboldali asszisztens."
                ),
              },
            ],
          },
          {
            id: "fixture-contact-2",
            customerRowKey: "fixture-contact-2",
            name: fixtureText("Quote Request", "Ajánlatkérés"),
            email: "quote@example.test",
            lifecycleState: "needs_reply",
            source: "page",
            latestMessageId: "fixture-message-3",
            latestSummary: fixtureText("Asked what affects the quote.", "Megkérdezte, mi befolyásolja az ajánlatot."),
            lastMessageAt: now,
            nextAction: {
              title: fixtureText("Reply to pricing question", "Válasz az árazási kérdésre"),
              description: fixtureText(
                "Answer the quote question and confirm the best next step.",
                "Válaszolj az ajánlatkérési kérdésre, és erősítsd meg a legjobb következő lépést."
              ),
            },
            chatMessages: [
              {
                role: "customer",
                label: fixtureText("Customer", "Ügyfél"),
                content: fixtureText("What affects the quote?", "Mi befolyásolja az ajánlatot?"),
                createdAt: now,
              },
            ],
            timeline: [
              {
                at: now,
                label: fixtureText("Front Desk page", "Front Desk oldal"),
                summary: fixtureText(
                  "Pricing question needs a clearer follow-up path.",
                  "Az árazási kérdéshez világosabb utánkövetési út kell."
                ),
              },
            ],
          },
          {
            id: "fixture-contact-3",
            customerRowKey: "fixture-contact-3",
            name: fixtureText("Anonymous visitor", "Névtelen látogató"),
            partialIdentity: true,
            lifecycleState: "needs_review",
            sources: ["chat"],
            flags: [fixtureText("follow up due", "utánkövetés esedékes")],
            latestMessageId: "fixture-message-3",
            latestSummary: fixtureText(
              "Asked for quote details but did not leave contact details.",
              "Ajánlatkérési részleteket kért, de nem hagyott elérhetőséget."
            ),
            lastMessageAt: now,
            nextAction: {
              title: fixtureText("Review open question", "Nyitott kérdés áttekintése"),
              description: fixtureText(
                "Review the conversation before deciding whether more contact details are needed.",
                "Nézd át a beszélgetést, mielőtt eldöntöd, szükség van-e további elérhetőségekre."
              ),
            },
            counts: {
              leads: 0,
              inboxThreads: 0,
              calendarEvents: 0,
              followUps: 0,
              outcomes: 0,
            },
            chatMessages: [
              {
                role: "customer",
                label: fixtureText("Customer", "Ügyfél"),
                content: fixtureText("Can you send a quote?", "Tudsz ajánlatot küldeni?"),
                createdAt: now,
              },
            ],
            timeline: [
              {
                at: now,
                label: fixtureText("Visitor message", "Látogatói üzenet"),
                source: "chat",
                summary: fixtureText(
                  "Asked for quote details without leaving email or phone.",
                  "Ajánlatkérési részleteket kért email vagy telefon megadása nélkül."
                ),
              },
            ],
          },
        ],
        summary: {
          ...createEmptyOperatorWorkspace().contacts.summary,
          totalContacts: 3,
          contactsNeedingAttention: 2,
          leadsWithoutNextStep: 1,
          contactsWithOutcomes: 1,
          lifecycleCounts: {
            ...createEmptyOperatorWorkspace().contacts.summary.lifecycleCounts,
            activeLead: 1,
            customer: 1,
          },
        },
      },
      businessProfile: {
        ...createEmptyOperatorWorkspace().businessProfile,
        readiness: {
          totalSections: 4,
          completedSections: 4,
          missingCount: 0,
          missingSections: [],
          summary: fixtureText(
            "Core local fixture business context is complete.",
            "Az alap helyi demó üzleti kontextusa teljes."
          ),
        },
      },
    };
    const connectedApps = createEmptyConnectedAppsState({
      capabilities: [
        {
          key: "whatsapp.business.webhook",
          provider: "whatsapp",
          appName: "WhatsApp Business",
          capability: "business.webhook",
          label: "WhatsApp Business webhook readiness",
          description: "Manual/status-only WhatsApp Business capability for future inbound webhook verification readiness.",
          status: "planned",
          requiresOAuth: false,
          requiresWebhook: true,
          requiresSecret: true,
          externalExecution: false,
          publicChatCallable: false,
          packageActivatable: false,
          allowedSurfaces: ["webhook", "dashboard", "internal"],
        },
        {
          key: "whatsapp.business.send.template",
          provider: "whatsapp",
          appName: "WhatsApp Business",
          capability: "business.send.template",
          label: "WhatsApp Business template send",
          description: "Manual WhatsApp Business capability for approved-template outbound messaging. Template sends are blocked until approved-template support is explicitly implemented.",
          status: "planned",
          requiresOAuth: false,
          requiresWebhook: false,
          requiresSecret: true,
          externalExecution: false,
          publicChatCallable: false,
          packageActivatable: false,
          allowedSurfaces: ["dashboard", "internal"],
        },
        {
          key: "whatsapp.business.send.session.reply",
          provider: "whatsapp",
          appName: "WhatsApp Business",
          capability: "business.send.session.reply",
          label: "WhatsApp Business session reply",
          description: "Manual staff WhatsApp Business session replies inside an allowed customer-service window. AI drafts require staff review and never send automatically.",
          status: "planned",
          requiresOAuth: false,
          requiresWebhook: false,
          requiresSecret: true,
          externalExecution: false,
          publicChatCallable: false,
          packageActivatable: false,
          allowedSurfaces: ["dashboard", "internal"],
        },
      ],
      connections: [
        {
          id: "fixture-whatsapp-connection",
          ownerUserId: authUser.id,
          provider: "whatsapp",
          appKey: "whatsapp.business",
          capabilityKeys: [
            "whatsapp.business.webhook",
            "whatsapp.business.send.template",
            "whatsapp.business.send.session.reply",
          ],
          status: "active",
          providerAccountId: "123456789012345",
          providerAccountLabel: fixtureText("Local WhatsApp Business", "Helyi WhatsApp Business"),
          scopesGranted: [],
          webhookStatus: "active",
          hasTokenSecretRef: false,
          lastVerifiedAt: now,
          needsAttentionReason: "",
          metadata: {
            setupMode: "manual_internal",
            whatsappBusinessAccountId: "123456789012345",
            phoneNumberId: "987654321098765",
            displayPhoneNumber: "redacted",
            businessDisplayName: fixtureText("Local Services", "Helyi Szolgáltatások"),
            webhookVerifyStatus: "verified",
            graphApiVersion: "v23.0",
          },
        },
      ],
      enablements: [
        {
          id: "fixture-whatsapp-enablement",
          ownerUserId: authUser.id,
          agentId: agent.id,
          connectionId: "fixture-whatsapp-connection",
          capabilityKeys: [
            "whatsapp.business.send.template",
            "whatsapp.business.send.session.reply",
          ],
          enabled: true,
          approvalMode: "manual_review",
          allowedSurfaces: ["dashboard"],
          metadata: { setupMode: "manual_internal" },
        },
      ],
      inboundThreads: [
        {
          id: "fixture-whatsapp-thread",
          ownerUserId: authUser.id,
          connectionId: "fixture-whatsapp-connection",
          agentId: null,
          provider: "whatsapp",
          appKey: "whatsapp.business",
          capabilityKey: "whatsapp.business.webhook",
          externalThreadLabel: fixtureText("WhatsApp conversation", "WhatsApp beszélgetés"),
          status: "open",
          lastEventId: "fixture-whatsapp-event",
          lastEventAt: now,
          lastEventType: "message",
          lastMessageType: "text",
          unreadCount: 1,
          metadata: {
            inboundReviewOnly: true,
            noAutomaticWhatsAppMessages: true,
            noAiReplies: true,
            noAiHandoff: true,
            lastInboundMessageAt: now,
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      inboundEvents: [
        {
          id: "fixture-whatsapp-event",
          ownerUserId: authUser.id,
          connectionId: "fixture-whatsapp-connection",
          agentId: null,
          provider: "whatsapp",
          appKey: "whatsapp.business",
          capabilityKey: "whatsapp.business.webhook",
          providerEventType: "message",
          providerMessageId: "wamid.fixture",
          providerTimestamp: now,
          eventDirection: "inbound",
          eventStatus: "received",
          normalized: {
            eventType: "message",
            messageType: "text",
            metadata: {
              hasText: true,
              textLength: 24,
              contactPresent: true,
            },
          },
          redactionSummary: {
            messageBodyStored: false,
            contactFieldsStored: false,
            providerPayloadStored: false,
          },
          threadId: "fixture-whatsapp-thread",
          receivedAt: now,
          createdAt: now,
        },
      ],
      manualReplies: {
        enabled: false,
        status: "disabled",
        lastOutbound: null,
      },
      aiDrafts: {
        enabled: false,
        status: "disabled",
        lastDraft: null,
      },
      readiness: {
        status: "ready",
        reportOnly: true,
        summary: {
          ready: 1,
          warning: 0,
          blocked: 0,
          requiredBlocked: 0,
          optionalWarnings: 0,
        },
        requirements: [
          {
            key: "required.whatsapp.business.send.template",
            capabilityKey: "whatsapp.business.send.template",
            requirementType: "required",
            status: "ready",
            label: "WhatsApp Business template send",
            provider: "whatsapp",
            appName: "WhatsApp Business",
            requiresOAuth: false,
            requiresWebhook: false,
            externalExecution: false,
            publicChatCallable: false,
            packageActivatable: false,
            connected: true,
            providerStatus: "active",
            scopeGranted: false,
            webhookActive: false,
            reasons: [],
          },
        ],
      },
      readinessContext: {
        requiredCapabilities: ["whatsapp.business.send.template"],
        connectedCapabilities: ["whatsapp.business.send.template"],
        providerStatuses: {
          "whatsapp.business.send.template": "active",
        },
        webhookStatuses: {
          "whatsapp.business.webhook": "active",
        },
        approvalMode: "manual_review",
        surface: "dashboard",
        executionRequested: false,
      },
      lastLoadedAt: now,
    });

    setStatus(fixtureText(
      "Local-only dashboard V2 fixture. Production auth and access gates are not bypassed.",
      "Csak helyi dashboard V2 demó. A production auth és hozzáférési kapuk nincsenek megkerülve."
    ));
    renderReadyState(agent, messages, actionQueue, operatorWorkspace, createEmptyFrontDeskTraining(), connectedApps);
  }

  window.VonzaDashboardFixture = Object.freeze({
    renderLocalDashboardV2Fixture,
  });
})(window);
