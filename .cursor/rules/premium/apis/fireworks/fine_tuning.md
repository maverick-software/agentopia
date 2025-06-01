# Fireworks AI - Fine-tuning & Customization SOP

## Overview
**Version:** 2.0  
**Last Updated:** May 2025  
**Service Category:** Model Customization & Training  
**Purpose:** Comprehensive implementation guide for Fireworks AI's fine-tuning capabilities including supervised fine-tuning, reinforcement learning, LoRA adapters, and custom model deployment.

---

## 🎯 FINE-TUNING CAPABILITIES

### 🔧 **Supervised Fine-Tuning v2**
#### Enhanced Features (2025)
- **Longer Context:** Support for up to 128K token context lengths
- **Quantization-Aware Training:** Maintain quality while reducing model size
- **Faster Training:** 3x speed improvements over previous version
- **Base Models:** Llama 3.1/4, DeepSeek, Qwen3, Mistral series

#### Supported Model Families
| Model Family | Max Context | Parameters | Fine-tuning Cost | Use Cases |
|--------------|-------------|------------|------------------|-----------|
| Llama 3.1 8B | 128K | 8B | $0.80/1K tokens | General purpose, coding |
| Llama 3.1 70B | 128K | 70B | $8.00/1K tokens | Complex reasoning, analysis |
| DeepSeek V3 | 128K | 671B | $24.00/1K tokens | Advanced reasoning, math |
| Qwen3 72B | 128K | 72B | $7.20/1K tokens | Multilingual, technical |
| Mistral 8x7B | 32K | 47B | $4.70/1K tokens | Efficient MoE architecture |

### 🎯 **Reinforcement Fine-Tuning (Beta)**
#### RL Tuning Capabilities
- **Reward-based Learning:** Train models using custom reward functions
- **Compositional Pipelines:** Combine supervised + RL tuning
- **Custom Evaluations:** Define domain-specific metrics
- **Iterative Improvement:** Continuous model refinement

#### RL Training Components
- **Reward Kit SDK:** Build custom reward functions
- **Evaluation Framework:** Test model performance
- **Policy Optimization:** Advanced RL algorithms (PPO, DPO)
- **Safety Constraints:** Ensure aligned behavior

### 🔄 **LoRA (Low-Rank Adaptation)**
#### LoRA Benefits
- **Fast Training:** 10x faster than full fine-tuning
- **Low Cost:** Fraction of full fine-tuning cost
- **Modularity:** Swap LoRA adapters for different tasks
- **Preservation:** Keep base model weights intact

#### LoRA Configurations
| LoRA Rank | Training Speed | Quality | Use Cases |
|-----------|----------------|---------|-----------|
| 8 | Fastest | Good | Quick prototyping |
| 16 | Fast | Better | Standard adaptation |
| 32 | Medium | High | Complex tasks |
| 64 | Slower | Highest | Maximum quality |

---

## 🔧 IMPLEMENTATION PATTERNS

### Basic Supervised Fine-tuning
```python
import requests
import json
from typing import List, Dict

class FireworksFinetuner:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def create_training_dataset(self, conversations: List[Dict], 
                              output_file: str = 'training_data.jsonl'):
        """
        Create training dataset in proper format
        """
        with open(output_file, 'w') as f:
            for conversation in conversations:
                # Format: {"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
                formatted_conv = {"messages": conversation["messages"]}
                f.write(json.dumps(formatted_conv) + '\n')
        
        return output_file
    
    def upload_dataset(self, file_path: str, dataset_name: str):
        """
        Upload training dataset to Fireworks
        """
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'name': dataset_name, 'purpose': 'fine-tune'}
            
            response = requests.post(
                f'{self.base_url}/files',
                headers={'Authorization': f'Bearer {self.api_key}'},
                files=files,
                data=data
            )
            
            response.raise_for_status()
            return response.json()['id']
    
    def start_fine_tuning(self, dataset_id: str, base_model: str, 
                         settings: Dict = None):
        """
        Start fine-tuning job
        """
        default_settings = {
            'n_epochs': 3,
            'learning_rate': 5e-5,
            'batch_size': 4,
            'lora_rank': 16,
            'context_length': 4096,
            'use_quantization': False
        }
        
        if settings:
            default_settings.update(settings)
        
        payload = {
            'training_file': dataset_id,
            'model': base_model,
            'hyperparameters': default_settings
        }
        
        response = requests.post(
            f'{self.base_url}/fine_tuning/jobs',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def monitor_training(self, job_id: str):
        """
        Monitor fine-tuning progress
        """
        response = requests.get(
            f'{self.base_url}/fine_tuning/jobs/{job_id}',
            headers={'Authorization': f'Bearer {self.api_key}'}
        )
        
        response.raise_for_status()
        return response.json()
    
    def list_fine_tuned_models(self):
        """
        List all fine-tuned models
        """
        response = requests.get(
            f'{self.base_url}/models',
            headers={'Authorization': f'Bearer {self.api_key}'},
            params={'owned_by': 'user'}
        )
        
        response.raise_for_status()
        return response.json()

# Usage example
finetuner = FireworksFinetuner('your_api_key_here')

# Prepare training data
training_conversations = [
    {
        "messages": [
            {"role": "user", "content": "What is machine learning?"},
            {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence..."}
        ]
    },
    {
        "messages": [
            {"role": "user", "content": "Explain neural networks"},
            {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks..."}
        ]
    }
    # Add more conversations...
]

# Create and upload dataset
dataset_file = finetuner.create_training_dataset(training_conversations)
dataset_id = finetuner.upload_dataset(dataset_file, "my_custom_dataset")

# Start fine-tuning
job = finetuner.start_fine_tuning(
    dataset_id=dataset_id,
    base_model='accounts/fireworks/models/llama-v3p1-8b-instruct',
    settings={
        'n_epochs': 5,
        'learning_rate': 3e-5,
        'lora_rank': 32,
        'context_length': 8192
    }
)

print(f"Fine-tuning job started: {job['id']}")

# Monitor progress
import time
while True:
    status = finetuner.monitor_training(job['id'])
    print(f"Status: {status['status']}")
    
    if status['status'] in ['succeeded', 'failed', 'cancelled']:
        break
    
    time.sleep(30)  # Check every 30 seconds

if status['status'] == 'succeeded':
    print(f"Fine-tuned model ready: {status['fine_tuned_model']}")
```

### Advanced LoRA Fine-tuning
```python
class AdvancedLoRATrainer:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def multi_task_lora_training(self, tasks: Dict[str, str]):
        """
        Train multiple LoRA adapters for different tasks
        """
        adapters = {}
        
        for task_name, dataset_id in tasks.items():
            print(f"Training LoRA adapter for: {task_name}")
            
            # Task-specific configurations
            task_config = self.get_task_config(task_name)
            
            job = self.start_lora_training(
                dataset_id=dataset_id,
                base_model='accounts/fireworks/models/llama-v3p1-8b-instruct',
                adapter_name=f"lora_{task_name}",
                config=task_config
            )
            
            adapters[task_name] = job['id']
        
        return adapters
    
    def get_task_config(self, task_name: str):
        """
        Get optimized config for specific tasks
        """
        configs = {
            'code_generation': {
                'lora_rank': 32,
                'learning_rate': 2e-4,
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj'],
                'lora_alpha': 64,
                'lora_dropout': 0.1
            },
            'summarization': {
                'lora_rank': 16,
                'learning_rate': 5e-5,
                'target_modules': ['q_proj', 'v_proj'],
                'lora_alpha': 32,
                'lora_dropout': 0.05
            },
            'creative_writing': {
                'lora_rank': 24,
                'learning_rate': 1e-4,
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj'],
                'lora_alpha': 48,
                'lora_dropout': 0.1
            },
            'math_reasoning': {
                'lora_rank': 64,
                'learning_rate': 3e-5,
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'lora_alpha': 128,
                'lora_dropout': 0.05
            }
        }
        
        return configs.get(task_name, configs['summarization'])
    
    def start_lora_training(self, dataset_id: str, base_model: str, 
                           adapter_name: str, config: Dict):
        """
        Start LoRA-specific training
        """
        payload = {
            'training_file': dataset_id,
            'model': base_model,
            'method': 'lora',
            'adapter_name': adapter_name,
            'hyperparameters': {
                'n_epochs': 3,
                'batch_size': 8,
                'gradient_accumulation_steps': 2,
                'warmup_steps': 100,
                'save_steps': 500,
                'logging_steps': 10,
                **config
            }
        }
        
        response = requests.post(
            f'{self.base_url}/fine_tuning/jobs',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def merge_lora_adapters(self, base_model: str, adapter_ids: List[str], 
                           output_model_name: str):
        """
        Merge multiple LoRA adapters into a single model
        """
        payload = {
            'base_model': base_model,
            'adapters': adapter_ids,
            'output_model': output_model_name,
            'merge_method': 'linear'  # or 'slerp', 'dare'
        }
        
        response = requests.post(
            f'{self.base_url}/models/merge',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()

# Usage example
trainer = AdvancedLoRATrainer('your_api_key_here')

# Train multiple task-specific adapters
tasks = {
    'code_generation': 'dataset_id_code',
    'summarization': 'dataset_id_summary', 
    'creative_writing': 'dataset_id_creative'
}

adapters = trainer.multi_task_lora_training(tasks)
print("Trained adapters:", adapters)
```

### Reinforcement Learning Fine-tuning
```python
class RLFinetuner:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def create_reward_function(self, evaluation_criteria: Dict):
        """
        Create custom reward function for RL training
        """
        reward_config = {
            'type': 'custom',
            'criteria': evaluation_criteria,
            'scoring_method': 'weighted_sum'
        }
        
        # Example criteria
        if 'helpfulness' in evaluation_criteria:
            reward_config['helpfulness_weight'] = evaluation_criteria['helpfulness']
        if 'accuracy' in evaluation_criteria:
            reward_config['accuracy_weight'] = evaluation_criteria['accuracy']
        if 'safety' in evaluation_criteria:
            reward_config['safety_weight'] = evaluation_criteria['safety']
        
        return reward_config
    
    def start_rl_training(self, base_model: str, reward_dataset_id: str,
                         reward_function: Dict, rl_config: Dict = None):
        """
        Start reinforcement learning training
        """
        default_config = {
            'algorithm': 'ppo',  # or 'dpo' for Direct Preference Optimization
            'learning_rate': 1e-5,
            'batch_size': 16,
            'ppo_epochs': 4,
            'clip_range': 0.2,
            'value_loss_coef': 0.1,
            'entropy_coef': 0.01,
            'max_grad_norm': 0.5,
            'n_training_steps': 1000
        }
        
        if rl_config:
            default_config.update(rl_config)
        
        payload = {
            'model': base_model,
            'method': 'reinforcement_learning',
            'reward_function': reward_function,
            'reward_dataset': reward_dataset_id,
            'hyperparameters': default_config
        }
        
        response = requests.post(
            f'{self.base_url}/fine_tuning/rl_jobs',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def create_preference_dataset(self, comparisons: List[Dict]):
        """
        Create preference dataset for DPO training
        """
        formatted_data = []
        
        for comparison in comparisons:
            formatted_data.append({
                'prompt': comparison['prompt'],
                'chosen': comparison['preferred_response'],
                'rejected': comparison['rejected_response'],
                'preference_strength': comparison.get('strength', 1.0)
            })
        
        return formatted_data
    
    def dpo_training(self, base_model: str, preference_data: List[Dict]):
        """
        Direct Preference Optimization training
        """
        # Upload preference dataset
        dataset_file = 'preference_data.jsonl'
        with open(dataset_file, 'w') as f:
            for item in preference_data:
                f.write(json.dumps(item) + '\n')
        
        dataset_id = self.upload_dataset(dataset_file, 'preference_dataset')
        
        # Start DPO training
        payload = {
            'model': base_model,
            'method': 'dpo',
            'training_file': dataset_id,
            'hyperparameters': {
                'beta': 0.1,  # DPO temperature parameter
                'learning_rate': 5e-7,
                'batch_size': 4,
                'max_length': 1024,
                'n_epochs': 3
            }
        }
        
        response = requests.post(
            f'{self.base_url}/fine_tuning/jobs',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()

# Usage example
rl_trainer = RLFinetuner('your_api_key_here')

# Create reward function
reward_criteria = {
    'helpfulness': 0.4,
    'accuracy': 0.4,
    'safety': 0.2
}

reward_function = rl_trainer.create_reward_function(reward_criteria)

# Start RL training
rl_job = rl_trainer.start_rl_training(
    base_model='accounts/fireworks/models/llama-v3p1-8b-instruct',
    reward_dataset_id='reward_dataset_id',
    reward_function=reward_function,
    rl_config={
        'algorithm': 'ppo',
        'learning_rate': 1e-5,
        'n_training_steps': 2000
    }
)

print(f"RL training started: {rl_job['id']}")
```

---

## ⚡ OPTIMIZATION STRATEGIES

### Training Performance Optimization
```python
class TrainingOptimizer:
    def __init__(self):
        self.optimization_configs = {
            'speed_optimized': {
                'batch_size': 16,
                'gradient_accumulation_steps': 1,
                'learning_rate': 1e-4,
                'n_epochs': 2,
                'lora_rank': 8
            },
            'quality_optimized': {
                'batch_size': 4,
                'gradient_accumulation_steps': 4,
                'learning_rate': 5e-5,
                'n_epochs': 5,
                'lora_rank': 64
            },
            'balanced': {
                'batch_size': 8,
                'gradient_accumulation_steps': 2,
                'learning_rate': 3e-5,
                'n_epochs': 3,
                'lora_rank': 32
            }
        }
    
    def optimize_dataset_size(self, dataset_size: int, model_size: str):
        """
        Recommend optimal training configuration based on dataset size
        """
        size_categories = {
            'small': (0, 1000),
            'medium': (1000, 10000),
            'large': (10000, 100000),
            'xlarge': (100000, float('inf'))
        }
        
        category = None
        for cat, (min_size, max_size) in size_categories.items():
            if min_size <= dataset_size < max_size:
                category = cat
                break
        
        recommendations = {
            'small': {
                'strategy': 'Use LoRA with higher rank, more epochs',
                'config': {
                    'lora_rank': 64,
                    'n_epochs': 8,
                    'learning_rate': 1e-4,
                    'regularization': 'high'
                }
            },
            'medium': {
                'strategy': 'Balanced approach with moderate LoRA rank',
                'config': {
                    'lora_rank': 32,
                    'n_epochs': 4,
                    'learning_rate': 5e-5,
                    'regularization': 'medium'
                }
            },
            'large': {
                'strategy': 'Lower LoRA rank, fewer epochs to prevent overfitting',
                'config': {
                    'lora_rank': 16,
                    'n_epochs': 2,
                    'learning_rate': 3e-5,
                    'regularization': 'low'
                }
            },
            'xlarge': {
                'strategy': 'Minimal LoRA rank, single epoch with careful learning rate',
                'config': {
                    'lora_rank': 8,
                    'n_epochs': 1,
                    'learning_rate': 1e-5,
                    'regularization': 'minimal'
                }
            }
        }
        
        return recommendations.get(category, recommendations['medium'])
    
    def calculate_training_cost(self, base_model: str, dataset_size: int, 
                              config: Dict):
        """
        Estimate training cost
        """
        model_costs = {
            'llama-3.1-8b': 0.80,
            'llama-3.1-70b': 8.00,
            'deepseek-v3': 24.00,
            'qwen3-72b': 7.20
        }
        
        base_cost = model_costs.get(base_model.split('/')[-1], 1.0)
        
        # Cost factors
        size_factor = dataset_size / 1000  # per 1K tokens
        epoch_factor = config.get('n_epochs', 3)
        rank_factor = config.get('lora_rank', 16) / 16
        
        estimated_cost = base_cost * size_factor * epoch_factor * rank_factor
        
        return {
            'estimated_cost_usd': round(estimated_cost, 2),
            'training_time_estimate': f"{estimated_cost * 0.5:.1f} hours",
            'cost_breakdown': {
                'base_cost': base_cost,
                'size_factor': size_factor,
                'epoch_factor': epoch_factor,
                'rank_factor': rank_factor
            }
        }
```

### Model Evaluation Framework
```python
class ModelEvaluator:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def evaluate_fine_tuned_model(self, model_id: str, test_dataset: List[Dict],
                                 metrics: List[str] = None):
        """
        Evaluate fine-tuned model performance
        """
        default_metrics = ['perplexity', 'bleu', 'rouge', 'accuracy']
        metrics = metrics or default_metrics
        
        results = {}
        
        for metric in metrics:
            if metric == 'perplexity':
                results[metric] = self.calculate_perplexity(model_id, test_dataset)
            elif metric == 'bleu':
                results[metric] = self.calculate_bleu_score(model_id, test_dataset)
            elif metric == 'rouge':
                results[metric] = self.calculate_rouge_score(model_id, test_dataset)
            elif metric == 'accuracy':
                results[metric] = self.calculate_accuracy(model_id, test_dataset)
        
        return results
    
    def compare_models(self, model_ids: List[str], test_dataset: List[Dict]):
        """
        Compare multiple models on the same test dataset
        """
        comparison_results = {}
        
        for model_id in model_ids:
            print(f"Evaluating model: {model_id}")
            results = self.evaluate_fine_tuned_model(model_id, test_dataset)
            comparison_results[model_id] = results
        
        # Generate comparison report
        return self.generate_comparison_report(comparison_results)
    
    def generate_comparison_report(self, results: Dict):
        """
        Generate detailed comparison report
        """
        report = {
            'summary': {},
            'detailed_results': results,
            'recommendations': {}
        }
        
        # Find best performing model for each metric
        for metric in ['perplexity', 'bleu', 'rouge', 'accuracy']:
            if metric in results[list(results.keys())[0]]:
                if metric == 'perplexity':
                    # Lower is better for perplexity
                    best_model = min(results.keys(), 
                                   key=lambda x: results[x][metric])
                else:
                    # Higher is better for other metrics
                    best_model = max(results.keys(), 
                                   key=lambda x: results[x][metric])
                
                report['summary'][f'best_{metric}'] = {
                    'model': best_model,
                    'score': results[best_model][metric]
                }
        
        return report
    
    def calculate_perplexity(self, model_id: str, test_data: List[Dict]):
        """Calculate model perplexity on test data"""
        # Implement perplexity calculation
        return 25.4  # Placeholder
    
    def calculate_bleu_score(self, model_id: str, test_data: List[Dict]):
        """Calculate BLEU score for generation tasks"""
        # Implement BLEU calculation
        return 0.65  # Placeholder
    
    def calculate_rouge_score(self, model_id: str, test_data: List[Dict]):
        """Calculate ROUGE score for summarization tasks"""
        # Implement ROUGE calculation
        return {'rouge-1': 0.45, 'rouge-2': 0.23, 'rouge-l': 0.38}
    
    def calculate_accuracy(self, model_id: str, test_data: List[Dict]):
        """Calculate accuracy for classification tasks"""
        # Implement accuracy calculation
        return 0.87  # Placeholder
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Custom Model Serving
```python
class CustomModelDeployment:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.fireworks.ai/inference/v1'
    
    def deploy_fine_tuned_model(self, model_id: str, deployment_config: Dict):
        """
        Deploy fine-tuned model to production
        """
        payload = {
            'model_id': model_id,
            'deployment_type': deployment_config.get('type', 'serverless'),
            'auto_scaling': deployment_config.get('auto_scaling', True),
            'min_instances': deployment_config.get('min_instances', 1),
            'max_instances': deployment_config.get('max_instances', 10),
            'instance_type': deployment_config.get('instance_type', 'A100'),
            'region': deployment_config.get('region', 'us-east-1')
        }
        
        response = requests.post(
            f'{self.base_url}/deployments',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def create_model_endpoint(self, deployment_id: str, endpoint_config: Dict):
        """
        Create API endpoint for deployed model
        """
        payload = {
            'deployment_id': deployment_id,
            'endpoint_name': endpoint_config.get('name', 'custom-model-api'),
            'rate_limit': endpoint_config.get('rate_limit', 100),
            'authentication': endpoint_config.get('auth', 'api_key'),
            'custom_headers': endpoint_config.get('headers', {}),
            'request_logging': endpoint_config.get('logging', True)
        }
        
        response = requests.post(
            f'{self.base_url}/endpoints',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json=payload
        )
        
        response.raise_for_status()
        return response.json()
    
    def monitor_deployment(self, deployment_id: str):
        """
        Monitor deployment health and performance
        """
        response = requests.get(
            f'{self.base_url}/deployments/{deployment_id}/metrics',
            headers={'Authorization': f'Bearer {self.api_key}'}
        )
        
        response.raise_for_status()
        metrics = response.json()
        
        return {
            'status': metrics.get('status'),
            'uptime': metrics.get('uptime_percentage'),
            'requests_per_minute': metrics.get('rpm'),
            'average_latency': metrics.get('avg_latency_ms'),
            'error_rate': metrics.get('error_rate_percentage'),
            'cost_per_hour': metrics.get('cost_usd_per_hour')
        }

# Usage example
deployer = CustomModelDeployment('your_api_key_here')

# Deploy fine-tuned model
deployment = deployer.deploy_fine_tuned_model(
    model_id='ft:llama-3.1-8b:your-model:abc123',
    deployment_config={
        'type': 'dedicated',
        'auto_scaling': True,
        'min_instances': 2,
        'max_instances': 20,
        'instance_type': 'H100',
        'region': 'us-west-2'
    }
)

# Create API endpoint
endpoint = deployer.create_model_endpoint(
    deployment_id=deployment['id'],
    endpoint_config={
        'name': 'my-custom-model-api',
        'rate_limit': 1000,
        'auth': 'api_key',
        'logging': True
    }
)

print(f"Custom model API endpoint: {endpoint['url']}")

# Monitor deployment
metrics = deployer.monitor_deployment(deployment['id'])
print(f"Deployment metrics: {metrics}")
```

---

## 📊 COST OPTIMIZATION & BEST PRACTICES

### Training Cost Calculator
```python
def calculate_optimal_training_strategy(dataset_size: int, quality_target: str, 
                                      budget_usd: float):
    """
    Calculate the most cost-effective training strategy
    """
    strategies = {
        'budget': {
            'method': 'lora',
            'rank': 8,
            'epochs': 2,
            'model_size': '8b',
            'cost_multiplier': 1.0
        },
        'balanced': {
            'method': 'lora', 
            'rank': 32,
            'epochs': 3,
            'model_size': '8b',
            'cost_multiplier': 2.5
        },
        'premium': {
            'method': 'full_finetune',
            'rank': None,
            'epochs': 5,
            'model_size': '70b',
            'cost_multiplier': 15.0
        }
    }
    
    base_cost = (dataset_size / 1000) * 0.80  # Base cost per 1K tokens
    
    recommendations = []
    for strategy_name, config in strategies.items():
        estimated_cost = base_cost * config['cost_multiplier']
        
        if estimated_cost <= budget_usd:
            recommendations.append({
                'strategy': strategy_name,
                'config': config,
                'estimated_cost': estimated_cost,
                'quality_score': {
                    'budget': 6,
                    'balanced': 8,
                    'premium': 10
                }[strategy_name]
            })
    
    return sorted(recommendations, key=lambda x: x['quality_score'], reverse=True)
```

---

*This SOP provides comprehensive guidance for implementing Fireworks AI's fine-tuning and customization capabilities. For the latest training techniques and model support, refer to the Fireworks AI documentation.* 