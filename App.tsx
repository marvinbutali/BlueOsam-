import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import DerivWS from './utils/derivWS';
import { storeAuthTokens } from './utils/derivAuth';
import { MarketType, getMarketDisplayName } from './utils/marketUtils';

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [markets, setMarkets] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [price, setPrice] = useState<string | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContractType, setSelectedContractType] = useState('');

  useEffect(() => {
    const appId = process.env.EXPO_PUBLIC_APP_ID || 'your_default_app_id';
    const token = process.env.EXPO_PUBLIC_TOKEN || '';

    storeAuthTokens([{ account: 'demo', token, currency: 'USD' }]);

    const ws = new DerivWS(appId);

    ws.setGlobalHandler((data) => {
      if (data.msg_type === 'authorize') {
        setStatus('Connected');

        ws.send({ active_symbols: 'brief', product_type: 'basic' }, (resp) => {
          const activeSymbols = resp.active_symbols;
          setSymbols(activeSymbols);

          const marketList = [...new Set(activeSymbols.map((s: any) => s.market))];
          setMarkets(marketList);
        });
      }

      if (data.error) {
        setStatus('Error: ' + data.error.message);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;

    const appId = process.env.EXPO_PUBLIC_APP_ID || 'your_default_app_id';
    const tickWs = new DerivWS(appId);

    tickWs.send({ ticks: selectedSymbol }, (tickData) => {
      if (tickData.tick) {
        setPrice(tickData.tick.quote.toFixed(5));
      }
    });

    tickWs.send({ contracts_for: selectedSymbol, product_type: 'basic' }, (resp) => {
      if (resp.contracts_for) {
        const availableContracts = resp.contracts_for.available.map((c: any) => c.contract_type);
        setContracts(availableContracts);
      }
    });

    return () => {
      tickWs.send({ forget_all: 'ticks' });
      tickWs.ws?.close();
    };
  }, [selectedSymbol]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Deriv WebSocket App</Text>
      <Text>Status: {status}</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Available Markets:</Text>
        {markets.map((mkt, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              setSelectedMarket(mkt);
              setSelectedSymbol('');
              setPrice(null);
              setContracts([]);
              setSelectedContractType('');
            }}
          >
            <Text style={styles.option}>• {getMarketDisplayName(mkt as MarketType)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedMarket && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Select Symbol:</Text>
          {symbols
            .filter((s) => s.market === selectedMarket)
            .map((s) => (
              <TouchableOpacity key={s.symbol} onPress={() => setSelectedSymbol(s.symbol)}>
                <Text style={styles.option}>• {s.display_name}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {selectedSymbol && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Live Price for {selectedSymbol}:</Text>
          <Text style={styles.price}>{price || 'Loading...'}</Text>
        </View>
      )}

      {contracts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Select Contract Type:</Text>
          {contracts.map((ct, index) => (
            <TouchableOpacity key={index} onPress={() => setSelectedContractType(ct)}>
              <Text style={styles.option}>• {ct}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedContractType && (
        <TouchableOpacity
          style={styles.buyButton}
          onPress={() => {
            const appId = process.env.EXPO_PUBLIC_APP_ID || 'your_default_app_id';
            const ws = new DerivWS(appId);

            const payload = {
              buy: 1,
              price: 10,
              parameters: {
                amount: 10,
                basis: 'stake',
                contract_type: selectedContractType,
                currency: 'USD',
                duration: 1,
                duration_unit: 'm',
                symbol: selectedSymbol,
              },
            };

            ws.send(payload, (res) => {
              if (res.buy) {
                alert(`✅ Bought: ${res.buy.longcode}`);
              } else if (res.error) {
                alert(`❌ Error: ${res.error.message}`);
              }
            });
          }}
        >
          <Text style={styles.buyText}>Buy</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  section: {
    marginTop: 20,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  option: {
    fontSize: 16,
    color: '#007bff',
    marginVertical: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'green',
  },
  buyButton: {
    marginTop: 16,
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
