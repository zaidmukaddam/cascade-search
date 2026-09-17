# The local tier of a System One stack

TypeSafe released Jev this week and called it a System One model. You hand it some state and a set of typed questions, and it returns choices with probabilities instead of text. No parsing, no JSON repair, and a confidence number your code can branch on. It answers in a few hundred milliseconds for $0.042 per million input tokens.

That is fast and cheap for a model. It is slow and expensive for a keystroke. A search box re-parses on every character, and a few hundred milliseconds of network per character is not a search box anyone wants to use.

So I built the tier that sits in front of it. cascade-search is a 26,947-parameter model that runs in the browser tab, reads a query like `open bugs from sam since tuesday` in about a quarter of a millisecond, and produces the same kind of output Jev does: a typed decision per word, each with a calibrated probability. When it is sure, the network is never touched. When it is not, it sends Jev the two or three words it is unsure about and nothing else.

## Same shape at both tiers

The part I care most about is that the two tiers are interchangeable at the type level.

Neither one writes a filter. Each assigns every word one of thirteen roles, such as field, category value, person, date, operator or noise, along with a probability. A single function, `compile(roles, schema)`, turns roles into the filter the app consumes. The app cannot tell which tier answered, because there is nothing to tell.

This is the System One idea pushed one level down. Jev's pitch is that structured decisions should stay structured instead of passing through prose. If the local tier emitted something looser, the cascade would need glue code at the seam, and glue code at the seam is where these systems rot.

It also means the schema's field names never reach either model. The local featurizer reports that a word "matched a field of kind person", not which field. Jev receives the words, the kinds, and the neighbours' roles. You can rename every column in the demo to random consonants and the parse does not move.

## Calibration is the router

A cascade is only as good as its decision to escalate. If the small model is confidently wrong, those errors are invisible, and if it is nervously right, you pay for calls you did not need.

I trained three confidence signals and compared them on four domains the model had never seen. The one I expected to win was a dedicated head trained to predict whether the model's own answer was right. It lost. Plain temperature scaling had better calibration, an expected calibration error of 0.0031 against 0.0037, and much better ranking, an AUROC of 0.978 against 0.921. It ships. I would rather report that than pretend the clever idea worked.

The number that justifies the project is this one. On the unseen domains, handing the least confident 1.23% of words to a perfect second tier brings word accuracy to 99.5%. Picking words at random needs 48%.

## What Jev actually did

A perfect second tier is a thought experiment, so I ran the real one: 600 queries from the unseen domains, live calls through Vercel AI Gateway.

Alone, the local model compiles exactly the right filter 93.5% of the time. With Jev answering the uncertain spans, that becomes 97.2%. About 18% of queries wait on the network and 2.65% of words are sent. It costs $0.0082 per thousand queries, which is roughly twelve dollars a month at fifty thousand queries a day.

The ceiling at that threshold is 99.25%, so Jev closes a bit more than half the gap. Two things are worth saying about the rest. First, some of Jev's misses look like my labels being wrong. It calls `than` in "more than 5" an operator, and my generator calls it noise. Jev has the better argument. Second, my first integration was worse than this, and the fix was not a prompt.

Early on, accuracy with Jev plateaued near 95.5% and even dipped as I escalated more. Looking at the disagreements, Jev was right on 30 of 34 contested words against the local model's 24. The damage came from the other direction: low-confidence Jev answers, the 0.50s and 0.55s, were overwriting local roles that had been correct. Because both tiers emit calibrated probabilities, the repair is one comparison. Jev's answer replaces the local one only where Jev is the more confident of the two. The curve became monotone and gained about a point and a half. That is the practical payoff of having probabilities you can trust on both sides of a seam.

## The loop

Every escalation is a labelled example: these words, in this context, turned out to be these roles, according to a stronger model that was confident about it. The demo logs them in the browser. A script turns an exported log into training rows, and the next training run includes them.

I have only run this loop on simulated traffic so far, a version of the issue tracker where people lead with a teammate's bare first name and use their own slang, which the training corpus never does. The results are in the README, labelled as simulated. The real test needs real visitors, and the demo is how I get them.

## What this does not show

The training corpus is synthetic. I wrote the generator, so strong numbers on it mean the model learned my grammar and carries it to vocabularies it has not seen. They do not mean it handles how people really type. Every figure above should be read with that in mind. The feedback loop is the plan for closing that gap, not evidence that it is closed.

The model and its weights are 34.6 KB compressed. The same weights run in plain TypeScript for single queries and as one WGSL compute kernel for batches, and a test checks that PyTorch, TypeScript and WGSL agree to within a thousandth on every logit.

The code, the evaluation scripts and the demo are in the repository. Drag the threshold in the demo and watch a query flip from local to Jev. That is the whole idea.
