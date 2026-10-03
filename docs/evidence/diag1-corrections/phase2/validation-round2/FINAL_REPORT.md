# DIAG-1 Phase 2 — relatório final

O HEAD de produção congelado para esta rodada é `80bb005f6bf9856720ac07d3acbae9e4a57c677f`, baseado em `369362c5b51757407e34493d9f9dcbeae86abdac`. A revisão independente leu esse intervalo em modo somente leitura, confirmou paridade remota `0/0` e retornou:

- **SPEC COMPLIANCE: PASS**
- **CODE QUALITY: PASS**
- **Critical: 0**
- **Important: 0**
- **Minor: 0**
- **PHASE 2 ACCEPTANCE RECOMMENDATION: YES**

## Correção entregue

1. O caminho único de conversão raw-food → support units continua sendo usado por residentes e provisórios.
2. Exposições físicas preservam intervalo datado, quantidades reais, cobertura conhecida e rejeição de sobreposição.
3. O leitor anual usa horizonte físico explícito de 360 dias; a pressão demográfica preserva o termo anual atual bruto, o termo recente anual arredondado e o crônico arredondado.
4. A oracle anual independente usa aritmética decimal/racional própria: **840/840 comparações, 0 divergências**.
5. Leituras parciais usam projeções coverage-safe; `rawSupportRatio` permanece telemetria do subconjunto conhecido.
6. Estados persistidos `exposureVersion=1` sem `nutritionCoverage` são reconstruídos a partir da exposição física antes dos leitores legados. A migração mantém a guarda explícita de versão e é idempotente.
7. O fixture legítimo produzido pelos bytes `bf5807e` (25% conhecido, 75% desconhecido) migra de `foodStress=1` para `foodStress=.25`, `nutritionCoverage=.25`, body-load limitado e pressure canônica.
8. O cálculo de fadiga usa recência por evento, sem o acumulador histórico antigo.

## Matriz fresca

- Cobertura/recovery: **37/37**; migração: **7/7**.
- RED contra os bytes originais `bf5807e`: **14/37 controles positivos**, com **23 falhas intencionais** — 20 discriminam comportamento antigo e 3 são controles de telemetria ausente; nenhum byte de produção foi alterado pelo overlay.
- Full-known compatibility: **48 linhas PASS** para histórias actual e legacy.
- Natural structural proof: seis cursos, 10.800 linhas diárias e 120 sazonais por curso; cobertura/classificação serializadas permanecem zero. A decisão não infere ausência de estado a partir de chave ausente.
- Mutantes `unknown_coverage`, `recovery_duration` e `surplus_coverage`: carregados, executados, detectados e restaurados.
- Context lifecycle de 12 anos: alvo de no máximo dois rebuilds completos por tick, igualdade com rebuild forçado, determinismo, parity do observer e invariância de ordem — **PASS** em todos os cenários.
- Provisórios: travel 10/10, subsistence 39/39, return reachability 12/12, reintegration 9/9, choice 11/11, quarantine 9/9, successor stabilization 28/28 e fission field transfer 12/12.
- Contabilidade de recovery, mobilidade capacity/authority, units 39/39, fatigue 31/31, demography 18/18, annual boundary 13/13, rounding 66/66, failed return 7/7, numeric resource chain, import boundary, architecture, TypeScript app/node e build: **PASS**.

`provisionalTwoDayIntegrationAudit` continua registrando a recusa herdada de `founder_cohort_declined` na preparação do alvo; esse gate é documentado, não foi alterado pela correção DIAG-1 e não bloqueia a recomendação final.

## Preservações e limites

O worktree protegido de World-M0 Task 12 permaneceu fora da implementação; os hashes de preservação continuam iguais. Não houve início de Phase 3 nem retomada de Task 12. O crescimento populacional não foi usado como oracle de aceitação.

## Evidências principais

Os JSONs e logs frescos estão em `docs/evidence/diag1-corrections/phase2/validation-round2/fresh/`, especialmente `annualNutritionLikeForLike-final.json`, `contextLifecycle-years12-final.log`, `coverageRecovery-final.json`, `coverageRecovery-original-final.json`, `migration-final-v5.json`, `fullKnownCompatibility-final.json` e `natural-reachability-structural-final.json`.
