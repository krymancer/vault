package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/spf13/cobra"
)

var baseURL = getEnv("VAULT_ADDR", "http://localhost:5045")

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var client = &http.Client{Timeout: 5 * time.Second}

type VaultStatus struct {
	Status int `json:"status"`
}

type InitResponse struct {
	Shards    []string `json:"shards"`
	Hash      string   `json:"hash"`
	RootToken string   `json:"rootToken"`
}

type UnsealResponse struct {
	Success bool `json:"success"`
}

type EncryptResponse struct {
	Ciphertext string `json:"ciphertext"`
}

type DecryptResponse struct {
	Plaintext string `json:"plaintext"`
}

type CreateTokenResponse struct {
	Token string `json:"token"`
	Name  string `json:"name"`
}

type AdminTokenResponse struct {
	Token string `json:"token"`
}

type TokenInfo struct {
	Token     string  `json:"token"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	CreatedAt string  `json:"createdAt"`
	ExpiresAt *string `json:"expiresAt"`
}

type TokenListResponse struct {
	Tokens []TokenInfo `json:"tokens"`
}

type CreateCredentialResponse struct {
	Id     string `json:"id"`
	Secret string `json:"secret"`
	Name   string `json:"name"`
	Kind   string `json:"kind"`
}

type CredentialInfo struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	CreatedAt string `json:"createdAt"`
}

type CredentialListResponse struct {
	Credentials []CredentialInfo `json:"credentials"`
}

type AuthResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

func getToken() string {
	return os.Getenv("VAULT_TOKEN")
}

func main() {
	var rootCmd = &cobra.Command{
		Use: "vault",
	}

	var statusCmd = &cobra.Command{
		Use:   "status",
		Short: "verify vault status",
		Run: func(cmd *cobra.Command, args []string) {
			checkStatus()
		},
	}

	var initCmd = &cobra.Command{
		Use:   "init <count> <threshold>",
		Short: "initialize vault with Shamir's Secret Sharing",
		Args:  cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			count, err := strconv.Atoi(args[0])
			if err != nil {
				fmt.Println("invalid count")
				return
			}
			threshold, err := strconv.Atoi(args[1])
			if err != nil {
				fmt.Println("invalid threshold")
				return
			}
			initVault(count, threshold)
		},
	}

	var unsealCmd = &cobra.Command{
		Use:   "unseal <threshold> <hash> <shard1> <shard2> ...",
		Short: "unseal vault with shards",
		Args:  cobra.MinimumNArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			threshold, err := strconv.Atoi(args[0])
			if err != nil {
				fmt.Println("invalid threshold")
				return
			}
			hash := args[1]
			shards := args[2:]
			unsealVault(threshold, hash, shards)
		},
	}

	var encryptCmd = &cobra.Command{
		Use:   "encrypt <plaintext>",
		Short: "encrypt a string (requires VAULT_TOKEN)",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			encryptData(args[0])
		},
	}

	var decryptCmd = &cobra.Command{
		Use:   "decrypt <ciphertext>",
		Short: "decrypt a hex ciphertext (requires VAULT_TOKEN)",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			decryptData(args[0])
		},
	}

	var authCmd = &cobra.Command{
		Use:   "auth <id> <secret>",
		Short: "authenticate with app/user credentials and get a token",
		Args:  cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			authenticate(args[0], args[1])
		},
	}

	// --- credential subcommands ---

	var credCmd = &cobra.Command{
		Use:   "credential",
		Short: "manage app/user credentials (requires admin VAULT_TOKEN)",
	}

	var credCreateCmd = &cobra.Command{
		Use:   "create <name> <app|user>",
		Short: "create a new credential",
		Args:  cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			createCredential(args[0], args[1])
		},
	}

	var credListCmd = &cobra.Command{
		Use:   "list",
		Short: "list all credentials",
		Run: func(cmd *cobra.Command, args []string) {
			listCredentials()
		},
	}

	var credDeleteCmd = &cobra.Command{
		Use:   "delete <id>",
		Short: "delete a credential",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			deleteCredential(args[0])
		},
	}

	credCmd.AddCommand(credCreateCmd, credListCmd, credDeleteCmd)

	// --- token subcommands ---

	var tokenCmd = &cobra.Command{
		Use:   "token",
		Short: "manage tokens (requires admin VAULT_TOKEN)",
	}

	var tokenCreateCmd = &cobra.Command{
		Use:   "create <name>",
		Short: "create a new app token",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			createToken(args[0])
		},
	}

	var tokenRevokeCmd = &cobra.Command{
		Use:   "revoke <token>",
		Short: "revoke a token",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			revokeToken(args[0])
		},
	}

	var tokenListCmd = &cobra.Command{
		Use:   "list",
		Short: "list all tokens",
		Run: func(cmd *cobra.Command, args []string) {
			listTokens()
		},
	}

	tokenCmd.AddCommand(tokenCreateCmd, tokenRevokeCmd, tokenListCmd)

	var adminTokenCmd = &cobra.Command{
		Use:   "admin-token <threshold> <hash> <shard1> <shard2> ...",
		Short: "generate an admin token using shards (backup)",
		Args:  cobra.MinimumNArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			threshold, err := strconv.Atoi(args[0])
			if err != nil {
				fmt.Println("invalid threshold")
				return
			}
			hash := args[1]
			shards := args[2:]
			getAdminToken(threshold, hash, shards)
		},
	}

	rootCmd.AddCommand(statusCmd, initCmd, unsealCmd, encryptCmd, decryptCmd, authCmd, credCmd, tokenCmd, adminTokenCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func postJSON(path string, body any) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return client.Post(baseURL+path, "application/json", bytes.NewReader(data))
}

func authedRequest(method, path string, body any) (*http.Response, error) {
	token := getToken()
	if token == "" {
		return nil, fmt.Errorf("VAULT_TOKEN not set")
	}

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, baseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return client.Do(req)
}

func checkStatus() {
	resp, err := client.Get(baseURL + "/version")
	if err != nil {
		fmt.Printf("error connecting to the API: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var status VaultStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		fmt.Printf("error reading the response: %v\n", err)
		return
	}

	if status.Status == 1 {
		fmt.Println("OPERATIONAL")
	} else {
		fmt.Println("CLOSED")
	}
}

func initVault(count, threshold int) {
	resp, err := postJSON("/init", map[string]int{
		"count":     count,
		"threshold": threshold,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result InitResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Printf("Root Token: %s\n\n", result.RootToken)
	fmt.Printf("Hash: %s\n\n", result.Hash)
	fmt.Println("Shards:")
	for i, shard := range result.Shards {
		fmt.Printf("  %d: %s\n", i+1, shard)
	}
}

func unsealVault(threshold int, hash string, shards []string) {
	resp, err := postJSON("/unseal", map[string]any{
		"shards":    shards,
		"threshold": threshold,
		"hash":      hash,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result UnsealResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	if result.Success {
		fmt.Println("UNSEALED")
	} else {
		fmt.Println("FAILED")
	}
}

func authenticate(id, secret string) {
	resp, err := postJSON("/auth", map[string]string{
		"id":     id,
		"secret": secret,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: invalid credentials")
		return
	}
	if resp.StatusCode == 403 {
		fmt.Println("error: vault is sealed")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Printf("Token:   %s\n", result.Token)
	fmt.Printf("Expires: %s\n", result.ExpiresAt)
}

func encryptData(plaintext string) {
	resp, err := authedRequest("POST", "/encrypt", map[string]string{
		"plaintext": plaintext,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (check VAULT_TOKEN)")
		return
	}
	if resp.StatusCode == 403 {
		fmt.Println("error: vault is sealed")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result EncryptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Println(result.Ciphertext)
}

func decryptData(ciphertext string) {
	resp, err := authedRequest("POST", "/decrypt", map[string]string{
		"ciphertext": ciphertext,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (check VAULT_TOKEN)")
		return
	}
	if resp.StatusCode == 403 {
		fmt.Println("error: vault is sealed")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result DecryptResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Println(result.Plaintext)
}

func createCredential(name, kind string) {
	resp, err := authedRequest("POST", "/credential", map[string]string{
		"name": name,
		"kind": kind,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode == 403 {
		fmt.Println("error: vault is sealed")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result CreateCredentialResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Printf("Id:     %s\n", result.Id)
	fmt.Printf("Secret: %s\n", result.Secret)
	fmt.Printf("Name:   %s\n", result.Name)
	fmt.Printf("Kind:   %s\n", result.Kind)
}

func listCredentials() {
	resp, err := authedRequest("GET", "/credential", nil)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result CredentialListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	for _, c := range result.Credentials {
		fmt.Printf("  %s  %s  [%s]\n", c.Id, c.Name, c.Kind)
	}
}

func deleteCredential(id string) {
	resp, err := authedRequest("DELETE", "/credential/"+id, nil)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode == 404 {
		fmt.Println("error: credential not found")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	fmt.Println("DELETED")
}

func createToken(name string) {
	resp, err := authedRequest("POST", "/token", map[string]string{
		"name": name,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result CreateTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Printf("Token: %s\n", result.Token)
	fmt.Printf("Name:  %s\n", result.Name)
}

func revokeToken(token string) {
	resp, err := authedRequest("DELETE", "/token/"+token, nil)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode == 404 {
		fmt.Println("error: token not found")
		return
	}
	if resp.StatusCode == 400 {
		fmt.Println("error: cannot revoke your own token")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	fmt.Println("REVOKED")
}

func listTokens() {
	resp, err := authedRequest("GET", "/token", nil)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: unauthorized (requires admin VAULT_TOKEN)")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result TokenListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	for _, t := range result.Tokens {
		expires := "never"
		if t.ExpiresAt != nil {
			expires = *t.ExpiresAt
		}
		fmt.Printf("  %s...  %s  [%s]  expires: %s\n", t.Token[:16], t.Name, t.Role, expires)
	}
}

func getAdminToken(threshold int, hash string, shards []string) {
	resp, err := postJSON("/admin-token", map[string]any{
		"shards":    shards,
		"threshold": threshold,
		"hash":      hash,
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("error: invalid shards or hash")
		return
	}
	if resp.StatusCode != 200 {
		fmt.Printf("error: server returned %d\n", resp.StatusCode)
		return
	}

	var result AdminTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("error reading response: %v\n", err)
		return
	}

	fmt.Printf("Admin Token: %s\n", result.Token)
}
