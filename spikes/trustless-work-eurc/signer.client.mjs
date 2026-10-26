import { requestAccess, getNetworkDetails, signTransaction } from '@stellar/freighter-api';

const button = document.querySelector('button');
const output = document.querySelector('#result');
const context = JSON.parse(document.querySelector('#context').textContent);
button.onclick = async () => {
  button.disabled = true;
  try {
    const access = await requestAccess();
    if (access.error || access.address !== context.signer) throw new Error('Select the required public account in Freighter, then retry.');
    const network = await getNetworkDetails();
    if (network.error || network.networkPassphrase !== context.network) throw new Error('Switch Freighter to Testnet.');
    const signed = await signTransaction(context.unsignedXdr, { networkPassphrase: context.network, address: context.signer });
    if (signed.error || !signed.signedTxXdr) throw new Error('Signature cancelled or failed.');
    output.textContent = 'Signed. Submitting once; do not refresh or repeat payment.';
    const response = await fetch('/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spike-Token': context.token }, body: JSON.stringify({ signedXdr: signed.signedTxXdr }) });
    const result = await response.json();
    output.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    output.textContent = e.message;
    button.disabled = false;
  }
};
