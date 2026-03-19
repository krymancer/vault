package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

type VaultStatus struct {
	Status int `json:"status"`
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

	rootCmd.AddCommand(statusCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func checkStatus() {
	client := &http.Client{Timeout: 5 * time.Second}

	// TODO: env variables to set this
	resp, err := client.Get("http://localhost:5045/version")
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
